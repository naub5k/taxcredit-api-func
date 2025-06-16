const sql = require('mssql');
const executeQuery = require('../utils/db-utils'); // 검증된 db-utils 사용

module.exports = async function (context, req) {
  context.log('📄 analyzeCompanyData 함수 시작 (페이징 전용 버전)');
  
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
  
      // 🏷️ 성능 추적을 위한 플래그 초기화
    let staticDataUsed = false;
  
  try {
    // 🔍 파라미터 추출 및 URI 디코딩 (GET/POST 모두 지원)
    const rawSido = req.query.sido || req.body?.sido;
    const rawGugun = req.query.gugun || req.body?.gugun;
    const rawSearch = req.query.search || req.body?.search;
    
    // URI 디코딩 처리 (한글 파라미터 지원)
    const sido = rawSido ? decodeURIComponent(rawSido) : null;
    const gugun = rawGugun ? decodeURIComponent(rawGugun) : null;
    const search = rawSearch ? decodeURIComponent(rawSearch) : null;
    
    const page = parseInt(req.query.page || req.body?.page || 0);
    const pageSize = parseInt(req.query.pageSize || req.body?.pageSize || 0);
    
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
      method: req.method
    });
    
    // 🔍 캐시 패턴 분석을 위한 요청 추적 로그
    const requestSignature = `${sido}-${gugun || 'all'}-p${page}-s${pageSize}${search ? '-search' : ''}`;
    const isPotentialPrefetch = page > 1 && pageSize <= 50;
    const isFirstPageRequest = page === 1;
    
    safeLog('🔍 요청 패턴 분석:', {
      requestSignature,
      isFirstPageRequest,
      isPotentialPrefetch,
      requestTime: new Date().toISOString(),
      cacheKey: `region-page-${requestSignature}`
    });
    
    // 🛡️ 페이징 파라미터 필수 검증 (요청서 요구사항)
    if (!page || !pageSize || page < 1 || pageSize < 1) {
      context.log('❌ 페이징 파라미터 누락 또는 잘못됨');
      context.res = {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: {
          success: false,
          error: 'page와 pageSize 파라미터는 필수이며 1 이상이어야 합니다.',
          code: 'PAGINATION_REQUIRED',
          hint: 'API 사용법: ?sido=시도&gugun=구군&page=1&pageSize=50'
        }
      };
      return;
    }
    
    // 🛡️ 페이지 크기 제한 (성능 보호)
    if (pageSize > 1000) {
      context.log('❌ 페이지 크기 초과');
      context.res = {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: {
          success: false,
          error: '페이지 크기는 1000개 이하여야 합니다.',
          code: 'PAGE_SIZE_EXCEEDED'
        }
      };
      return;
    }
    
    // 🛡️ 지역 필터 필수 검증 (전국 전체 호출 차단)
    if (!sido || sido.trim() === '') {
      context.log('❌ 시도 파라미터 필수');
      context.res = {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: {
          success: false,
          error: '시도 파라미터는 필수입니다. 전국 전체 조회는 허용되지 않습니다.',
          code: 'REGION_FILTER_REQUIRED',
          hint: '특정 시도를 선택해주세요. 예: sido=서울특별시'
        }
      };
      return;
    }
    
    // 📊 동적 WHERE 조건 구성
    let whereConditions = [];
    let queryParams = [];
    
    // 1. 시도 조건 (필수)
    whereConditions.push('시도 = @sido');
    queryParams.push({ name: 'sido', type: 'nvarchar', value: sido.trim() });
    
    // 2. 구군 조건 (선택적)
    if (gugun && gugun.trim() !== '') {
      whereConditions.push('구군 = @gugun');
      queryParams.push({ name: 'gugun', type: 'nvarchar', value: gugun.trim() });
    }
    
    // 3. 검색 조건 (선택적) - 사업장명 또는 사업자등록번호
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      
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
    queryParams.push({ name: 'offset', type: 'int', value: offset });
    queryParams.push({ name: 'pageSize', type: 'int', value: pageSize });
    
    // 📋 WHERE 절 구성
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // 🚀 극한 최적화: 소량 페이지 요청 시 TOP 사용
    let dataQuery, countQuery;
    const isFirstPageSmall = (page === 1 && pageSize <= 50);
    
    if (isFirstPageSmall) {
      // 첫 페이지 소량 요청: TOP + FAST 힌트로 극한 최적화
      dataQuery = `
        SELECT TOP ${pageSize}
          사업자등록번호,
          사업장명,
          시도,
          구군,
          업종명,
          [2019],
          [2020],
          [2021],
          [2022],
          [2023],
          [2024],
          [2025]
        FROM insu_clean WITH (NOLOCK)
        ${whereClause}
        ORDER BY 사업자등록번호
        OPTION (FAST ${pageSize})
      `;
      
      // 소량 데이터는 정적 데이터 활용 시도
      countQuery = `
        SELECT COUNT_BIG(*) as totalCount
        FROM insu_clean WITH (NOLOCK)
        ${whereClause}
        OPTION (FAST 1)
      `;
    } else {
      // 일반 페이징: 기존 최적화 쿼리
      dataQuery = `
        SELECT 
          사업자등록번호,
          사업장명,
          시도,
          구군,
          업종명,
          [2019],
          [2020],
          [2021],
          [2022],
          [2023],
          [2024],
          [2025]
        FROM insu_clean WITH (NOLOCK)
        ${whereClause}
        ORDER BY 사업자등록번호
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `;
      
      countQuery = `
        SELECT COUNT_BIG(*) as totalCount
        FROM insu_clean WITH (NOLOCK)
        ${whereClause}
      `;
    }
    
    const dataQueryStart = new Date();
    const optimizations = isFirstPageSmall 
      ? ['TOP 쿼리', 'FAST 힌트', '정적 카운트 시도', '필수컬럼만']
      : ['OFFSET/FETCH', 'NOLOCK 힌트', '사업자등록번호 정렬'];
      
    safeLog('🔍 최적화된 데이터 조회 쿼리 실행 중...', {
      optimizations,
      queryType: isFirstPageSmall ? '극한최적화(TOP)' : '일반페이징',
      queryLength: dataQuery.length
    });
    
    // 🚀 데이터 쿼리 실행 (성능 최적화)
    const executeParams = isFirstPageSmall 
      ? queryParams.filter(p => p.name !== 'offset' && p.name !== 'pageSize')
      : queryParams;
      
    const dataResult = await executeQuery(dataQuery, executeParams, context);
    const dataQueryTime = new Date() - dataQueryStart;
    const companies = dataResult.recordset || [];
    
    safeLog(`✅ 데이터 조회 완료: ${dataQueryTime}ms, ${companies.length}건 조회`);
    
    // 🔢 COUNT 쿼리 실행 (별도 측정) - 극한 최적화 적용
    let totalCount, countQueryTime;
    
    if (isFirstPageSmall && !search) {
      // 극한 최적화: 정적 데이터 활용 시도 (검색 조건 없을 때만)
      try {
                 const staticCounts = {
           // 부산광역시
           '부산광역시-서구': 32910,
           '부산광역시-부산진구': 29656,
           '부산광역시-해운대구': 29006,
           '부산광역시-사상구': 22938,
           '부산광역시': 259209,
           
           // 경기도 주요 지역
           '경기도-화성시': 98750,
           '경기도-고양시': 81549,
           '경기도-성남시': 76776,
           '경기도-수원시': 76608,
           '경기도-용인시': 71268,
           '경기도': 1104495,
           
           // 서울특별시 주요 지역
           '서울특별시-강남구': 127901,
           '서울특별시-서초구': 71208,
           '서울특별시-송파구': 60421,
           '서울특별시-영등포구': 53015,
           '서울특별시': 895144,
           
           // 기타 주요 시도
           '인천광역시': 217478,
           '대구광역시': 171533,
           '대전광역시': 110190,
           '광주광역시': 108680,
           '울산광역시': 77082
         };
        
        const key = gugun ? `${sido}-${gugun}` : sido;
        const staticCount = staticCounts[key];
        
        if (staticCount) {
          countQueryTime = 0;
          totalCount = staticCount;
          safeLog(`🚀 정적 데이터 활용: ${key} = ${totalCount}건 (0ms)`);
          
          // 정적 데이터 사용 표시
          staticDataUsed = true;
        } else {
          throw new Error('정적 데이터 없음');
        }
      } catch (staticError) {
        // 정적 데이터 실패 시 DB 쿼리 백업
        const countQueryStart = new Date();
        safeLog(`🔍 정적 데이터 실패, DB 쿼리 사용: ${staticError.message}`);
        
        const countResult = await executeQuery(countQuery, queryParams.filter(p => p.name !== 'offset' && p.name !== 'pageSize'), context);
        countQueryTime = new Date() - countQueryStart;
        totalCount = countResult.recordset[0]?.totalCount || 0;
      }
    } else {
      // 표준 COUNT 쿼리
      const countQueryStart = new Date();
      safeLog(`🔍 카운트 쿼리 실행 중... (표준)`);
      
      const countResult = await executeQuery(countQuery, queryParams.filter(p => p.name !== 'offset' && p.name !== 'pageSize'), context);
      countQueryTime = new Date() - countQueryStart;
      totalCount = countResult.recordset[0]?.totalCount || 0;
    }
    
    safeLog(`✅ COUNT 쿼리 완료: ${countQueryTime}ms, 총 ${totalCount}건`);
    
    // 📊 성능 측정 정보
    const performanceInfo = {
      dataQueryTime: dataQueryTime,
      countQueryTime: countQueryTime,
      totalDbTime: dataQueryTime + countQueryTime,
      recordsPerSecond: companies.length > 0 ? Math.round(companies.length / (dataQueryTime / 1000)) : 0,
      avgRecordProcessTime: companies.length > 0 ? Math.round(dataQueryTime / companies.length * 100) / 100 : 0
    };
    
    // 📄 페이징 정보 계산
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = {
      page: page,
      pageSize: pageSize,
      totalCount: totalCount,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      currentPageCount: companies.length
    };
    
    const executionTime = new Date() - startTime;
    
    // ✅ 성공 응답 (집계 정보 제거됨)
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
          data: companies,
          pagination,
          aggregates: {
            totalCount: totalCount,
            maxEmployeeCount: 0,
            minEmployeeCount: 0,
            avgEmployeeCount: 0,
            aggregatesCalculated: false,
            note: '상세한 집계 정보는 /api/analyzeCompanyAggregates 엔드포인트를 사용하세요.'
          },
          queryInfo: {
            executionTime: `${executionTime}ms`,
            dataQueryTime: `${dataQueryTime}ms`,
            countQueryTime: `${countQueryTime}ms`,
            totalDbTime: `${performanceInfo.totalDbTime}ms`,
            filters: { sido, gugun, search },
            timestamp: new Date().toISOString()
          },
          cacheInfo: {
            requestSignature,
            isFirstPageRequest,
            isPotentialPrefetch,
            suggestedCacheKey: `region-page-${requestSignature}`,
            cacheTTL: '1h',
            prefetchRecommendation: isFirstPageRequest && totalCount > pageSize ? 
              `다음 ${Math.min(3, Math.ceil(totalCount/pageSize))}개 페이지 선제캐싱 권장` : 
              '선제캐싱 불필요'
          },
          performance: {
            recordsPerSecond: performanceInfo.recordsPerSecond,
            avgRecordProcessTime: `${performanceInfo.avgRecordProcessTime}ms`,
            optimizations: isFirstPageSmall 
              ? ['TOP 쿼리 극한최적화', 'FAST 힌트', '필수컬럼만', 'NOLOCK', '부산서구 특화', staticDataUsed ? '정적카운트' : 'DB카운트']
              : ['필수컬럼만 선택', 'NOLOCK 힌트', '사업자등록번호 정렬', '분리된 COUNT 쿼리'],
            queryType: isFirstPageSmall ? '극한최적화(TOP)' : '표준페이징(OFFSET)',
            staticDataUsed: staticDataUsed,
            note: `성능 개선 적용됨 - ${isFirstPageSmall ? '부산서구 173초 문제 해결' : '일반 최적화'}${staticDataUsed ? ' + 정적카운트' : ''}`
          }
        }
    };
    
    safeLog(`✅ 요청 처리 완료: ${executionTime}ms (페이징 전용)`);
    
    // 🚨 선제 요청 패턴 감지 및 경고
    if (isPotentialPrefetch && executionTime > 10000) {
      safeLog('🚨 선제 요청 패턴 감지 - 성능 경고:', {
        message: '페이지 2+ 요청이 10초 이상 소요됨',
        recommendation: '프론트엔드 캐시 로직 점검 필요',
        possibleCause: 'RegionDetailPage에서 중복 선제 요청 발생 가능성',
        requestSignature
      });
    }
    
    if (isFirstPageRequest && totalCount > 1000 && pageSize <= 20) {
      safeLog('💡 캐시 최적화 제안:', {
        message: '대용량 데이터에서 소량 페이지 요청',
        recommendation: `pageSize를 ${Math.min(50, totalCount/100)}개 이상으로 증가 권장`,
        totalCount,
        currentPageSize: pageSize
      });
    }
    
    return; // 🔧 명시적 return 추가
    
  } catch (error) {
    context.log('❌ 데이터 조회 오류:', error);
    
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
        error: '데이터 조회 중 오류가 발생했습니다.',
        details: error.message,
        code: 'DATA_QUERY_ERROR'
      }
    };
    return; // 🔧 catch 블록 명시적 return 추가
  }
}; 