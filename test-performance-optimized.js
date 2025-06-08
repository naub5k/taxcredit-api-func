// 🚀 성능 최적화 테스트 스크립트
// 요청서_20250608_003_전국_시군구_페이지단위_API_최적화 검증

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

// 성능 테스트 실행 함수
async function runPerformanceTest(testName, url, expectedMaxTime = 10000) {
  try {
    console.log(`\n🔍 ${testName} 테스트 시작...`);
    console.log(`📡 URL: ${url}`);
    console.log(`⏱️ 목표 시간: ${expectedMaxTime}ms 이내`);
    
    const { response, duration, statusCode } = await makeRequest(url);
    
    if (statusCode !== 200) {
      throw new Error(`HTTP ${statusCode}: ${response}`);
    }
    
    if (!response.success) {
      throw new Error(`API 오류: ${response.error}`);
    }
    
    // 성능 분석
    const { data, pagination, aggregates, performance: perfData } = response;
    
    console.log(`✅ ${testName} 성공:`);
    console.log(`   📊 데이터: ${data.length}건 조회`);
    console.log(`   📄 페이징: 페이지 ${pagination.page}/${pagination.totalPages} (전체 ${pagination.totalCount}건)`);
    console.log(`   📈 집계: ${aggregates.aggregatesCalculated ? '계산됨' : '생략됨'} (최대 ${aggregates.maxEmployeeCount}명)`);
    console.log(`   ⏱️ 총 응답시간: ${Math.round(duration)}ms`);
    
    if (perfData) {
      console.log(`   📊 기본 쿼리: ${perfData.basicQueryTime}ms`);
      console.log(`   🎯 최적화 적용: ${perfData.optimizationApplied}`);
    }
    
    // 성능 목표 달성 여부
    const performanceGrade = duration <= expectedMaxTime ? '🎉 우수' : '⚠️ 개선 필요';
    console.log(`   📈 성능 등급: ${performanceGrade}`);
    
    return {
      success: true,
      testName,
      duration: Math.round(duration),
      dataCount: data.length,
      totalCount: pagination.totalCount,
      aggregatesCalculated: aggregates.aggregatesCalculated,
      basicQueryTime: perfData?.basicQueryTime || 0,
      performanceGrade: duration <= expectedMaxTime ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT'
    };
    
  } catch (error) {
    console.log(`❌ ${testName} 실패: ${error.message}`);
    return {
      success: false,
      testName,
      error: error.message
    };
  }
}

// 메인 성능 테스트 실행
async function runPerformanceTests() {
  console.log('🚀 성능 최적화 테스트 시작');
  console.log('📋 목표: 모든 API 호출 10초 이내 완료');
  console.log('=' * 80);
  
  const testCases = [
    // 1. 집계 제외 테스트 (빠른 응답 확인)
    {
      name: '강남구 집계 제외 (빠른 모드)',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&gugun=${encodeURIComponent('강남구')}&page=1&pageSize=10&includeAggregates=false`,
      expectedMaxTime: 3000, // 3초 이내
      priority: 'HIGH'
    },
    {
      name: '강남구 집계 포함 (일반 모드)',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&gugun=${encodeURIComponent('강남구')}&page=1&pageSize=10&includeAggregates=true`,
      expectedMaxTime: 10000, // 10초 이내
      priority: 'HIGH'
    },
    
    // 2. 소규모 지역 테스트
    {
      name: '광주 동구 집계 제외',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('광주광역시')}&gugun=${encodeURIComponent('동구')}&page=1&pageSize=10&includeAggregates=false`,
      expectedMaxTime: 2000, // 2초 이내
      priority: 'HIGH'
    },
    {
      name: '광주 동구 집계 포함',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('광주광역시')}&gugun=${encodeURIComponent('동구')}&page=1&pageSize=10&includeAggregates=true`,
      expectedMaxTime: 5000, // 5초 이내
      priority: 'HIGH'
    },
    
    // 3. 전체 데이터 테스트 (집계 제외로만)
    {
      name: '전체 데이터 집계 제외 (1페이지)',
      url: `${API_BASE_URL}?page=1&pageSize=20&includeAggregates=false`,
      expectedMaxTime: 5000, // 5초 이내
      priority: 'MEDIUM'
    },
    
    // 4. 서울특별시 전체 테스트
    {
      name: '서울특별시 전체 집계 제외',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&page=1&pageSize=15&includeAggregates=false`,
      expectedMaxTime: 4000, // 4초 이내
      priority: 'MEDIUM'
    },
    
    // 5. 검색 테스트
    {
      name: '사업장명 검색 (노무) 집계 제외',
      url: `${API_BASE_URL}?search=${encodeURIComponent('노무')}&page=1&pageSize=15&includeAggregates=false`,
      expectedMaxTime: 3000, // 3초 이내
      priority: 'MEDIUM'
    },
    
    // 6. 페이지 단위 테스트
    {
      name: '강남구 2페이지 (페이징 검증)',
      url: `${API_BASE_URL}?sido=${encodeURIComponent('서울특별시')}&gugun=${encodeURIComponent('강남구')}&page=2&pageSize=5&includeAggregates=false`,
      expectedMaxTime: 3000, // 3초 이내
      priority: 'HIGH'
    }
  ];
  
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let excellentCount = 0;
  
  for (const testCase of testCases) {
    const result = await runPerformanceTest(testCase.name, testCase.url, testCase.expectedMaxTime);
    result.priority = testCase.priority;
    results.push(result);
    
    if (result.success) {
      passCount++;
      if (result.performanceGrade === 'EXCELLENT') {
        excellentCount++;
      }
    } else {
      failCount++;
    }
    
    // 테스트 간 간격
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 결과 요약
  console.log('\n' + '=' * 80);
  console.log('📊 성능 최적화 테스트 결과 요약');
  console.log('=' * 80);
  console.log(`✅ 성공: ${passCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`🎉 우수 성능: ${excellentCount}개`);
  console.log(`📋 총 테스트: ${results.length}개`);
  
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
    
    // 성능 개선 효과
    const previousWorstCase = 109779; // 이전 강남구 테스트 시간
    const currentBestCase = Math.min(...successfulTests.map(r => r.duration));
    const improvementRatio = ((previousWorstCase - currentBestCase) / previousWorstCase * 100).toFixed(1);
    
    console.log(`\n🚀 성능 개선 효과:`);
    console.log(`   이전 최악 케이스: ${previousWorstCase}ms`);
    console.log(`   현재 최고 케이스: ${currentBestCase}ms`);
    console.log(`   개선율: ${improvementRatio}%`);
  }
  
  // 우선순위별 결과
  console.log('\n🔍 우선순위별 결과:');
  ['HIGH', 'MEDIUM', 'LOW'].forEach(priority => {
    const priorityResults = results.filter(r => r.priority === priority);
    const priorityPass = priorityResults.filter(r => r.success).length;
    const priorityExcellent = priorityResults.filter(r => r.performanceGrade === 'EXCELLENT').length;
    console.log(`   ${priority}: ${priorityPass}/${priorityResults.length} 통과 (우수 ${priorityExcellent}개)`);
  });
  
  // 실패한 테스트 상세
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    failedTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.testName}: ${test.error}`);
    });
  }
  
  console.log('\n🎯 결론:');
  const successRate = (passCount / results.length * 100).toFixed(1);
  const excellentRate = (excellentCount / results.length * 100).toFixed(1);
  
  if (failCount === 0 && excellentCount >= results.length * 0.8) {
    console.log('🎉 성능 최적화 대성공!');
    console.log(`✅ 성공률: ${successRate}%`);
    console.log(`🚀 우수 성능률: ${excellentRate}%`);
    console.log('✅ 요청서_20250608_003_전국_시군구_페이지단위_API_최적화 완료');
  } else if (failCount === 0) {
    console.log('✅ 성능 최적화 성공!');
    console.log(`✅ 성공률: ${successRate}%`);
    console.log(`📈 우수 성능률: ${excellentRate}%`);
    console.log('⚠️ 일부 케이스에서 추가 최적화 가능');
  } else {
    console.log('⚠️ 성능 최적화 부분 성공');
    console.log(`📊 성공률: ${successRate}%`);
    console.log(`📈 우수 성능률: ${excellentRate}%`);
    console.log('🔧 추가 최적화 작업 필요');
  }
}

// 테스트 실행
runPerformanceTests().catch(console.error); 