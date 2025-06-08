/**
 * analyzeCompanyData 함수 테스트 스크립트
 * 로컬 및 배포된 환경에서 analyzeCompanyData API를 테스트합니다.
 */

const axios = require('axios');

// 테스트 설정
const TEST_CONFIG = {
  LOCAL_URL: 'http://localhost:7071/api/analyzeCompanyData',
  PROD_URL: 'https://taxcredit-api-func.azurewebsites.net/api/analyzeCompanyData',
  TEST_CASES: [
    {
      name: '서울특별시 전체',
      params: { sido: '서울특별시' }
    },
    {
      name: '서울특별시 강남구',
      params: { sido: '서울특별시', gugun: '강남구' }
    },
    {
      name: '경기도 성남시',
      params: { sido: '경기도', gugun: '성남시' }
    },
    {
      name: '페이징 테스트 (1페이지, 10건)',
      params: { sido: '서울특별시', page: 1, pageSize: 10 }
    },
    {
      name: '페이징 테스트 (2페이지, 5건)',
      params: { sido: '서울특별시', gugun: '강남구', page: 2, pageSize: 5 }
    }
  ]
};

// 테스트 실행 함수
async function testAnalyzeCompanyData(baseUrl, testCase) {
  console.log(`\n🧪 테스트: ${testCase.name}`);
  console.log(`📋 파라미터:`, testCase.params);
  
  try {
    const startTime = Date.now();
    
    const response = await axios.get(baseUrl, {
      params: testCase.params,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 응답 성공 (${duration}ms)`);
    console.log(`📊 상태 코드: ${response.status}`);
    
    const data = response.data;
    
    if (data.success) {
      console.log(`📈 결과 요약:`);
      console.log(`   - 조회된 데이터: ${data.data?.length || 0}건`);
      console.log(`   - 전체 개수: ${data.pagination?.totalCount || 0}건`);
      console.log(`   - 총 페이지: ${data.pagination?.totalPages || 0}페이지`);
      console.log(`   - 현재 페이지: ${data.pagination?.page || 1}페이지`);
      
      if (data.aggregates) {
        console.log(`   - 최대 고용인원: ${data.aggregates.maxEmployeeCount}명`);
        console.log(`   - 평균 고용인원: ${data.aggregates.avgEmployeeCount}명`);
      }
      
      // 첫 번째 데이터 샘플 출력
      if (data.data && data.data.length > 0) {
        const firstItem = data.data[0];
        console.log(`📋 첫 번째 데이터 샘플:`);
        console.log(`   - 사업장명: ${firstItem.사업장명}`);
        console.log(`   - 사업자등록번호: ${firstItem.사업자등록번호}`);
        console.log(`   - 업종명: ${firstItem.업종명}`);
        console.log(`   - 지역: ${firstItem.시도} ${firstItem.구군}`);
        
        // 연도별 데이터 확인
        const yearData = [];
        for (let year = 2020; year <= 2024; year++) {
          const value = firstItem[year.toString()] || firstItem[`[${year}]`] || 0;
          yearData.push(`${year}: ${value}명`);
        }
        console.log(`   - 최근 5년 고용인원: ${yearData.join(', ')}`);
      }
      
    } else {
      console.log(`❌ API 오류: ${data.error}`);
      if (data.details) {
        console.log(`📝 상세: ${data.details}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ 요청 실패:`);
    if (error.response) {
      console.log(`   - 상태 코드: ${error.response.status}`);
      console.log(`   - 응답 메시지: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      console.log(`   - 네트워크 오류: 서버에 도달할 수 없습니다.`);
    } else {
      console.log(`   - 오류: ${error.message}`);
    }
  }
}

// 잘못된 파라미터 테스트
async function testErrorCases(baseUrl) {
  console.log(`\n🚨 오류 케이스 테스트`);
  
  const errorCases = [
    {
      name: '시도 파라미터 누락',
      params: { gugun: '강남구' }
    },
    {
      name: '존재하지 않는 시도',
      params: { sido: '존재하지않는시도' }
    }
  ];
  
  for (const errorCase of errorCases) {
    try {
      console.log(`\n🧪 오류 테스트: ${errorCase.name}`);
      const response = await axios.get(baseUrl, {
        params: errorCase.params,
        timeout: 10000
      });
      
      if (response.data.success === false) {
        console.log(`✅ 예상된 오류 응답: ${response.data.error}`);
      } else {
        console.log(`⚠️ 예상과 다른 응답: 성공으로 응답됨`);
      }
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`✅ 예상된 400 오류: ${error.response.data?.error || 'Bad Request'}`);
      } else {
        console.log(`❌ 예상과 다른 오류: ${error.message}`);
      }
    }
  }
}

// 메인 테스트 함수
async function runTests() {
  console.log('🚀 analyzeCompanyData API 테스트 시작');
  console.log('='.repeat(50));
  
  // 환경별 테스트
  const environments = [
    { name: '로컬 환경', url: TEST_CONFIG.LOCAL_URL },
    { name: '프로덕션 환경', url: TEST_CONFIG.PROD_URL }
  ];
  
  for (const env of environments) {
    console.log(`\n🌍 ${env.name} 테스트 (${env.url})`);
    console.log('-'.repeat(40));
    
    // 기본 연결 테스트
    try {
      const healthCheck = await axios.get(env.url + '?sido=서울특별시&pageSize=1', { timeout: 5000 });
      console.log(`✅ ${env.name} 연결 성공`);
    } catch (error) {
      console.log(`❌ ${env.name} 연결 실패: ${error.message}`);
      console.log(`⏭️ ${env.name} 테스트 건너뛰기\n`);
      continue;
    }
    
    // 정상 케이스 테스트
    for (const testCase of TEST_CONFIG.TEST_CASES) {
      await testAnalyzeCompanyData(env.url, testCase);
    }
    
    // 오류 케이스 테스트
    await testErrorCases(env.url);
  }
  
  console.log('\n🎉 모든 테스트 완료!');
  console.log('='.repeat(50));
}

// 스크립트 실행
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testAnalyzeCompanyData }; 