const sql = require('mssql');
const executeQuery = require('../utils/db-utils'); // 검증된 db-utils 사용

module.exports = async function (context, req) {
  context.log('🏢 analyzeCompanyData 함수 시작 (성능 최적화 + UTF-8 버전)');
  
  const startTime = new Date();
  
  try {
    // 🔍 파라미터 추출 (GET/POST 모두 지원)
    const sido = req.query.sido || req.body?.sido;
    const gugun = req.query.gugun || req.body?.gugun;
    const search = req.query.search || req.body?.search; // 검색 파라미터 추가
    const page = parseInt(req.query.page || req.body?.page || 1);
    const pageSize = parseInt(req.query.pageSize || req.body?.pageSize || 50);
    const includeAggregates = req.query.includeAggregates !== 'false'; // 집계 포함 여부 (기본값: true)
    
    // UTF-8 안전 로깅 함수
    const safeLog = (message, data = null) => {
      if (data) {
        context.log(message, JSON.stringify(data, null, 2));
      } else {
        context.log(message);
      }
    };
    
    safeLog('📋 요청 파라미터:', {
      sido,
      gugun,
      search,
      page,
      pageSize,
      includeAggregates,
      method: req.method
    });
    
    // 🛡️ 페이징 파라미터 검증
    if (page < 1 || pageSize < 1 || pageSize > 1000) {
      context.log('❌ 잘못된 페이징 파라미터');
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          success: false,
          error: '페이지는 1 이상, 페이지 크기는 1-1000 사이여야 합니다.',
          code: 'INVALID_PAGINATION_PARAMETER'
        }
      };
      return;
    }
    
    // 📊 동적 WHERE 조건 구성
    let whereConditions = [];
    let queryParams = [];
    
    // 1. 시도 조건 (선택적)
    if (sido && sido.trim() !== '') {
      whereConditions.push('시도 = @sido');
      queryParams.push({ name: 'sido', type: 'nvarchar', value: sido.trim() });
    }
    
    // 2. 구군 조건 (선택적)
    if (gugun && gugun.trim() !== '') {
      whereConditions.push('구군 = @gugun');
      queryParams.push({ name: 'gugun', type: 'nvarchar', value: gugun.trim() });
    }
    
    // 3. 검색 조건 (선택적) - 사업장명 또는 사업자등록번호
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      
      // 🔍 검색어 유형 판별
      if (/^[0-9]{10}$/.test(searchTerm)) {
        // 사업자등록번호 검색 (10자리 숫자)
        whereConditions.push('사업자등록번호 = @search');
        queryParams.push({ name: 'search', type: 'nvarchar', value: searchTerm });
        safeLog(`🔍 사업자등록번호 검색: ${searchTerm}`);
      } else {
        // 사업장명 부분 검색 (LIKE)
        whereConditions.push('사업장명 LIKE @search');
        queryParams.push({ name: 'search', type: 'nvarchar', value: `%${searchTerm}%` });
        safeLog(`🔍 사업장명 검색: ${searchTerm}`);
      }
    }
    
    // 🔢 페이징 처리를 위한 OFFSET/FETCH 추가
    const offset = (page - 1) * pageSize;
    
    // 📋 WHERE 절 구성 (조건이 없으면 전체 데이터)
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // 📋 기본 데이터 조회 쿼리 (모든 케이스에 페이징 적용)
    const dataQuery = `
      SELECT *
      FROM insu_clean 
      ${whereClause}
      ORDER BY 사업장명
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;
    
    // 🔢 전체 개수 조회 쿼리 (빠른 COUNT만)
    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM insu_clean 
      ${whereClause}
    `;
    
    // 페이징 파라미터 추가
    const dataQueryParams = [
      ...queryParams,
      { name: 'offset', type: 'int', value: offset },
      { name: 'pageSize', type: 'int', value: pageSize }
    ];
    
    safeLog('🔍 실행할 쿼리들:');
    safeLog('  - WHERE 조건:', whereClause || '(전체 데이터)');
    safeLog('  - 데이터 쿼리:', dataQuery);
    safeLog('  - 개수 쿼리:', countQuery);
    
    // 📊 기본 쿼리 실행 (데이터 + 개수)
    const [dataResult, countResult] = await Promise.all([
      executeQuery(dataQuery, dataQueryParams, context),
      executeQuery(countQuery, queryParams, context)
    ]);
    
    const companies = dataResult.recordset || [];
    const totalCount = countResult.recordset[0]?.totalCount || 0;
    
    const basicQueryTime = new Date() - startTime;
    safeLog(`✅ 기본 쿼리 완료: ${companies.length}건 조회 (전체 ${totalCount}건) - ${basicQueryTime}ms`);
    
    // 📊 집계 정보 처리 (선택적 실행)
    let processedAggregates = {
      totalCount: parseInt(totalCount),
      maxEmployeeCount: 0,
      minEmployeeCount: 0,
      avgEmployeeCount: 0,
      aggregatesCalculated: false
    };
    
    // 집계 쿼리는 필요한 경우에만 실행 (성능 최적화)
    if (includeAggregates && totalCount > 0 && totalCount < 50000) { // 5만건 이하에서만 집계 실행
      try {
        safeLog('📊 집계 쿼리 실행 중...');
        const aggregateQueryStart = new Date();
        
        // 📊 간소화된 집계 정보 조회 쿼리
        const aggregateQuery = `
          SELECT 
            MAX(ISNULL([2024], 0)) as maxEmployeeCount2024,
            MIN(ISNULL([2024], 0)) as minEmployeeCount2024,
            AVG(CAST(ISNULL([2024], 0) AS FLOAT)) as avgEmployeeCount2024
          FROM insu_clean 
          ${whereClause}
        `;
        
        const aggregateResult = await executeQuery(aggregateQuery, queryParams, context);
        const aggregates = aggregateResult.recordset[0] || {};
        
        processedAggregates = {
          totalCount: parseInt(totalCount),
          maxEmployeeCount: parseInt(aggregates.maxEmployeeCount2024) || 0,
          minEmployeeCount: parseInt(aggregates.minEmployeeCount2024) || 0,
          avgEmployeeCount: Math.round(parseFloat(aggregates.avgEmployeeCount2024) || 0),
          aggregatesCalculated: true
        };
        
        const aggregateQueryTime = new Date() - aggregateQueryStart;
        safeLog(`✅ 집계 쿼리 완료: ${aggregateQueryTime}ms`);
        
      } catch (aggregateError) {
        safeLog('⚠️ 집계 쿼리 실행 실패, 기본값 사용:', aggregateError.message);
      }
    } else if (totalCount >= 50000) {
      safeLog(`⚠️ 대용량 데이터 (${totalCount}건)로 인해 집계 쿼리 생략`);
    }
    
    // 📄 페이징 정보 계산
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = {
      page: page,
      pageSize: pageSize,
      totalCount: totalCount,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
    
    // 🔄 응답 데이터 처리 (연도별 컬럼명 정규화)
    const processedData = companies.map(company => {
      const processed = { ...company };
      
      // 연도별 데이터 접근 편의성을 위한 정규화
      // 🚨 **2019년부터 시작 (2019년 이전은 경정청구 기한 만료)**
  for (let year = 2019; year <= 2025; year++) {
        const yearStr = year.toString();
        const bracketYear = `[${year}]`;
        
        // [2024] 형태의 컬럼이 있으면 2024로도 접근 가능하게 함
        if (processed[bracketYear] !== undefined && processed[yearStr] === undefined) {
          processed[yearStr] = processed[bracketYear];
        }
      }
      
      return processed;
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    safeLog(`🎯 analyzeCompanyData 완료: ${duration}ms 소요`);
    
    // 🎉 성공 응답
    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: {
        success: true,
        data: processedData,
        pagination: pagination,
        aggregates: processedAggregates,
        performance: {
          queryDuration: duration,
          basicQueryTime: basicQueryTime,
          aggregatesCalculated: processedAggregates.aggregatesCalculated,
          optimizationApplied: true
        },
        metadata: {
          sido: sido || null,
          gugun: gugun || null,
          search: search || null,
          timestamp: new Date().toISOString(),
          version: '2.1.0',
          queryType: whereConditions.length === 0 ? 'ALL_DATA' : 
                     search ? 'SEARCH' : 'REGION_FILTER'
        }
      }
    };
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;
    
    context.log('❌ analyzeCompanyData 오류:', error);
    console.error('analyzeCompanyData 오류 상세:', error.message, error.stack);
    
    context.res = {
      status: 500,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: {
        success: false,
        error: '데이터 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        metadata: {
          queryDuration: duration,
          timestamp: new Date().toISOString(),
          errorType: error.name
        }
      }
    };
  }
}; 