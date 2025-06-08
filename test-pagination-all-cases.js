// ✅ 전체 케이스 페이징 테스트 스크립트 
// 요청서_20250608_002_API_페이지단위_호출구조개선 완전 검증

const https = require('https');
const { performance } = require('perf_hooks');

const API_BASE_URL = 'https://taxcredit-api-func.azurewebsites.net/api/analyzeCompanyData';

// HTTP 요청 헬퍼 함수
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const duration = performance.now() - startTime;
          const response = JSON.parse(data);
          resolve({ response, duration, statusCode: res.statusCode });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// 테스트 케이스 실행 함수
async function runTestCase(testName, url) {
  try {
    console.log(`\n🔍 ${testName} 테스트 시작...`);
    console.log(`📡 URL: ${url}`);
    
    const { response, duration, statusCode } = await makeRequest(url);
    
    if (statusCode !== 200) {
      throw new Error(`HTTP ${statusCode}: ${response}`);
    }
    
    if (!response.success) {
      throw new Error(`API 오류: ${response.error}`);
    }
    
    // 페이징 검증
    const { data, pagination, aggregates } = response;
    
    console.log(`✅ ${testName} 성공:`);
    console.log(`   📊 데이터: ${data.length}건 조회`);
    console.log(`   📄 페이징: 페이지 ${pagination.page}/${pagination.totalPages} (전체 ${pagination.totalCount}건)`);
    console.log(`   📈 집계: 최대 ${aggregates.maxEmployeeCount}명, 평균 ${aggregates.avgEmployeeCount}명`);
    console.log(`   ⏱️ 응답시간: ${Math.round(duration)}ms`);
    
    // 페이징 필수 요소 검증
    const requiredFields = ['page', 'pageSize', 'totalCount', 'totalPages', 'hasNext', 'hasPrev'];
    const missingFields = requiredFields.filter(field => pagination[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`페이징 필수 필드 누락: ${missingFields.join(', ')}`);
    }
    
    // OFFSET/FETCH 검증 (pageSize 준수 확인)
    if (data.length > pagination.pageSize) {
      throw new Error(`페이지 크기 초과: ${data.length} > ${pagination.pageSize}`);
    }
    
    return {
      success: true,
      dataCount: data.length,
      totalCount: pagination.totalCount,
      page: pagination.page,
      totalPages: pagination.totalPages,
      duration: Math.round(duration)
    };
    
  } catch (error) {
    console.log(`❌ ${testName} 실패: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// 메인 테스트 실행
async function runAllTests() {
  console.log('🚀 모든 케이스 페이징 테스트 시작');
  console.log('📋 요구사항: SELECT * FROM insu_clean 모든 조건에 페이징 적용 필수');
  console.log('=' * 70);
  
  const testCases = [
    // 1. 전체 데이터 페이징 테스트
    {
      name: '전체 데이터 페이징 (시도/구군 없음)',
      url: `${API_BASE_URL}?page=1&pageSize=10`,
      priority: 'HIGH'
    },
    {
      name: '전체 데이터 2페이지',
      url: `${API_BASE_URL}?page=2&pageSize=10`,
      priority: 'HIGH'
    },
    
    // 2. 지역별 페이징 테스트
    {
      name: '서울특별시 전체',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&page=1&pageSize=10`,
      priority: 'HIGH'
    },
    {
      name: '서울 강남구 페이징',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&gugun=${encodeURIComponent('강남구')}&page=1&pageSize=5`,
      priority: 'HIGH'
    },
    {
      name: '서울 강남구 2페이지',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&gugun=${encodeURIComponent('강남구')}&page=2&pageSize=5`,
      priority: 'HIGH'
    },
    
    // 3. 검색 페이징 테스트
    {
      name: '사업장명 검색 (노무)',
      url: `${API_BASE_URL}?search=${encodeURIComponent('노무')}&page=1&pageSize=10`,
      priority: 'HIGH'
    },
    {
      name: '사업장명 검색 2페이지',
      url: `${API_BASE_URL}?search=${encodeURIComponent('노무')}&page=2&pageSize=10`,
      priority: 'MEDIUM'
    },
    {
      name: '사업자등록번호 검색',
      url: `${API_BASE_URL}?search=1148638828&page=1&pageSize=10`,
      priority: 'HIGH'
    },
    
    // 4. 혼합 조건 페이징 테스트
    {
      name: '서울 + 검색 혼합',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&search=${encodeURIComponent('세무')}&page=1&pageSize=5`,
      priority: 'MEDIUM'
    },
    
    // 5. 대용량 페이지 크기 테스트
    {
      name: '큰 페이지 크기 (50건)',
      url: `${API_BASE_URL}?page=1&pageSize=50`,
      priority: 'LOW'
    }
  ];
  
  const results = [];
  let passCount = 0;
  let failCount = 0;
  
  for (const testCase of testCases) {
    const result = await runTestCase(testCase.name, testCase.url);
    result.priority = testCase.priority;
    results.push(result);
    
    if (result.success) {
      passCount++;
    } else {
      failCount++;
    }
    
    // 테스트 간 간격
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 결과 요약
  console.log('\n' + '=' * 70);
  console.log('📊 테스트 결과 요약');
  console.log('=' * 70);
  console.log(`✅ 성공: ${passCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`📋 총 테스트: ${results.length}개`);
  
  // 우선순위별 결과
  console.log('\n🔍 우선순위별 결과:');
  ['HIGH', 'MEDIUM', 'LOW'].forEach(priority => {
    const priorityResults = results.filter(r => r.priority === priority);
    const priorityPass = priorityResults.filter(r => r.success).length;
    console.log(`   ${priority}: ${priorityPass}/${priorityResults.length} 통과`);
  });
  
  // 실패한 테스트 상세
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    failedTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.error}`);
    });
  }
  
  // 성능 분석
  const successfulTests = results.filter(r => r.success);
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const maxDuration = Math.max(...successfulTests.map(r => r.duration));
    const minDuration = Math.min(...successfulTests.map(r => r.duration));
    
    console.log('\n⏱️ 성능 분석:');
    console.log(`   평균 응답시간: ${Math.round(avgDuration)}ms`);
    console.log(`   최대 응답시간: ${maxDuration}ms`);
    console.log(`   최소 응답시간: ${minDuration}ms`);
  }
  
  console.log('\n🎯 결론:');
  if (failCount === 0) {
    console.log('🎉 모든 SELECT * FROM insu_clean 쿼리에 페이징이 정상 적용되었습니다!');
    console.log('✅ 요청서_20250608_002_API_페이지단위_호출구조개선 완료');
  } else {
    console.log('⚠️ 일부 테스트 실패. 추가 수정이 필요합니다.');
  }
}

// 테스트 실행
runAllTests().catch(console.error); 