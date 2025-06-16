const sql = require('mssql');
const executeQuery = require('../utils/db-utils');

module.exports = async function (context, req) {
  context.log('📊 analyzeCompanyAggregates 함수 시작 - 집계 정보 전용');
  
  // 🔧 CORS Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400' // 24시간
      },
      body: ''
    };
    return;
  }
  
  const startTime = new Date();
  
  try {
    // 🔍 파라미터 추출 및 URI 디코딩
    const rawSido = req.query.sido || req.body?.sido;
    const rawGugun = req.query.gugun || req.body?.gugun;
    const rawSearch = req.query.search || req.body?.search;
    
    // URI 디코딩 처리 (한글 파라미터 지원)
    const sido = rawSido ? decodeURIComponent(rawSido) : null;
    const gugun = rawGugun ? decodeURIComponent(rawGugun) : null;
    const search = rawSearch ? decodeURIComponent(rawSearch) : null;
    const includeAggregates = req.query.includeAggregates !== 'false'; // 기본값: true
    
    const safeLog = (message, data = null) => {
      if (data) {
        context.log(message, JSON.stringify(data, null, 2));
      } else {
        context.log(message);
      }
    };
    
    safeLog('📋 집계 요청 파라미터:', { sido, gugun, search, includeAggregates });
    
    // 📊 동적 WHERE 조건 구성
    let whereConditions = [];
    let queryParams = [];
    
    if (sido && sido.trim() !== '') {
      whereConditions.push('시도 = @sido');
      queryParams.push({ name: 'sido', type: 'nvarchar', value: sido.trim() });
    }
    
    if (gugun && gugun.trim() !== '') {
      whereConditions.push('구군 = @gugun');
      queryParams.push({ name: 'gugun', type: 'nvarchar', value: gugun.trim() });
    }
    
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      if (/^[0-9]{10}$/.test(searchTerm)) {
        whereConditions.push('사업자등록번호 = @search');
        queryParams.push({ name: 'search', type: 'nvarchar', value: searchTerm });
      } else {
        whereConditions.push('사업장명 LIKE @search');
        queryParams.push({ name: 'search', type: 'nvarchar', value: `%${searchTerm}%` });
      }
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // 🔢 전체 개수 조회
    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM insu_clean 
      ${whereClause}
    `;
    
    const countResult = await executeQuery(countQuery, queryParams, context);
    const totalCount = countResult.recordset[0]?.totalCount || 0;
    
    let aggregates = {
      totalCount: parseInt(totalCount),
      maxEmployeeCount: 0,
      minEmployeeCount: 0,
      avgEmployeeCount: 0,
      aggregatesCalculated: false
    };
    
    // 📊 집계 정보 조회 (요청서 요구사항: includeAggregates가 true면 항상 계산)
    if (includeAggregates && totalCount > 0) {
      try {
        safeLog('📊 집계 정보 계산 중...');
        
        let aggregateQuery;
        let aggregateParams = [...queryParams];
        
        // 대용량 데이터 처리: 5만건 이상이면 샘플링 사용
        if (totalCount > 50000) {
          safeLog(`⚡ 대용량 데이터 (${totalCount}건) - 샘플링 집계 사용`);
          
          // 고정 1만건 샘플링으로 집계 계산
          const sampleSize = 10000;
          
          aggregateQuery = `
            SELECT 
              MAX(ISNULL([2024], 0)) as maxEmployeeCount2024,
              MIN(ISNULL([2024], 0)) as minEmployeeCount2024,
              AVG(CAST(ISNULL([2024], 0) AS FLOAT)) as avgEmployeeCount2024,
              COUNT(*) as validRecords
            FROM (
              SELECT TOP ${sampleSize} [2024]
              FROM insu_clean 
              ${whereClause}
              ORDER BY NEWID()
            ) AS SampleData
          `;
        } else {
          // 소용량 데이터는 전체 집계
          safeLog(`📊 소용량 데이터 (${totalCount}건) - 전체 집계 사용`);
          aggregateQuery = `
            SELECT 
              MAX(ISNULL([2024], 0)) as maxEmployeeCount2024,
              MIN(ISNULL([2024], 0)) as minEmployeeCount2024,
              AVG(CAST(ISNULL([2024], 0) AS FLOAT)) as avgEmployeeCount2024,
              COUNT(*) as validRecords
            FROM insu_clean 
            ${whereClause}
          `;
        }
        
        const aggregateResult = await executeQuery(aggregateQuery, aggregateParams, context);
        const aggData = aggregateResult.recordset[0] || {};
        
        aggregates = {
          totalCount: parseInt(totalCount),
          maxEmployeeCount: parseInt(aggData.maxEmployeeCount2024) || 0,
          minEmployeeCount: parseInt(aggData.minEmployeeCount2024) || 0,
          avgEmployeeCount: Math.round(parseFloat(aggData.avgEmployeeCount2024) || 0),
          validRecords: parseInt(aggData.validRecords) || 0,
          aggregatesCalculated: true,
          samplingUsed: totalCount > 100000,
          note: totalCount > 100000 ? '대용량 데이터로 인해 샘플링 집계 사용' : '전체 데이터 집계'
        };
        
        safeLog('✅ 집계 정보 계산 완료', aggregates);
        
      } catch (aggregateError) {
        safeLog('⚠️ 집계 계산 실패, 기본값 사용:', aggregateError.message);
        aggregates.aggregatesCalculated = false;
        aggregates.error = aggregateError.message;
      }
    } else if (!includeAggregates) {
      safeLog('ℹ️ includeAggregates=false로 집계 계산 생략');
      aggregates.totalCount = parseInt(totalCount);
      aggregates.note = 'includeAggregates=false로 집계 계산 생략됨';
    } else {
      safeLog('ℹ️ 데이터가 없어 집계 계산 생략');
      aggregates.note = '조회된 데이터가 없음';
    }
    
    // 📈 지역별 분포 정보 (시도별 집계 - 제한 완화)
    let regionDistribution = null;
    if (totalCount > 0 && !gugun) { // 구군이 지정되지 않은 경우에만
      try {
        safeLog('📊 지역별 분포 계산 중...');
        
        let regionQuery;
        if (sido) {
          // 특정 시도 내 구군별 분포
          regionQuery = `
            SELECT 구군 as region, COUNT(*) as count
            FROM insu_clean 
            ${whereClause}
            GROUP BY 구군
            ORDER BY COUNT(*) DESC
          `;
        } else {
          // 전국 시도별 분포 (대용량이어도 GROUP BY는 빠름)
          regionQuery = `
            SELECT 시도 as region, COUNT(*) as count
            FROM insu_clean 
            ${whereClause}
            GROUP BY 시도
            ORDER BY COUNT(*) DESC
          `;
        }
        
        const regionResult = await executeQuery(regionQuery, queryParams, context);
        regionDistribution = regionResult.recordset;
        
        safeLog(`✅ 지역별 분포 계산 완료: ${regionDistribution.length}개 지역`);
        
      } catch (regionError) {
        safeLog('⚠️ 지역별 분포 계산 실패:', regionError.message);
      }
    } else if (gugun) {
      safeLog('ℹ️ 구군이 지정되어 지역별 분포 계산 생략');
    }
    
    const executionTime = new Date() - startTime;
    
    // ✅ 성공 응답
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
        aggregates,
        regionDistribution,
        queryInfo: {
          executionTime: `${executionTime}ms`,
          filters: { sido, gugun, search },
          parameters: { includeAggregates },
          timestamp: new Date().toISOString(),
          version: '2.0.0'
        }
      }
    };
    
    safeLog(`✅ 집계 정보 조회 완료: ${executionTime}ms`);
    
  } catch (error) {
    context.log('❌ 집계 정보 조회 오류:', error);
    
    context.res = {
      status: 500,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: {
        success: false,
        error: '집계 정보 조회 중 오류가 발생했습니다.',
        details: error.message,
        code: 'AGGREGATES_QUERY_ERROR',
        timestamp: new Date().toISOString()
      }
    };
  }
}; 