// 🧪 API 로컬 테스트 스크립트
const axios = require('axios').default;

const BASE_URL = 'http://localhost:7071/api';

console.log('🚀 Azure Functions 로컬 테스트 시작');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log('');

// 테스트 함수들
const tests = [
  {
    name: 'getSampleList 기본 조회',
    url: `${BASE_URL}/getSampleList?page=1&pageSize=3`,
    method: 'GET'
  },
  {
    name: 'getSampleList 서울 조회',
    url: `${BASE_URL}/getSampleList?sido=서울특별시&page=1&pageSize=3`,
    method: 'GET'
  },
  {
    name: 'analyze 테스트 (테스트 사업자번호)',
    url: `${BASE_URL}/analyze?bizno=1111111111`,
    method: 'GET'
  }
];

// 테스트 실행
async function runTests() {
  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name} 테스트 중...`);
      
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 30000
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ 성공: ${response.status} (${duration}ms)`);
      
      if (response.data) {
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log(`   📊 데이터: ${response.data.data.length}건`);
        }
        if (response.data.analysisResult) {
          console.log(`   💰 총 공제액: ${response.data.analysisResult.summary.총계.toLocaleString()}원`);
        }
      }
      
    } catch (error) {
      console.log(`❌ 실패: ${error.message}`);
      if (error.response) {
        console.log(`   응답 코드: ${error.response.status}`);
        console.log(`   에러: ${error.response.data?.error || '상세 불명'}`);
      }
    }
    
    console.log('');
  }
  
  console.log('🎯 테스트 완료');
}

// 로컬 서버 확인 먼저
async function checkServer() {
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/admin/host/status`, { timeout: 5000 });
    console.log('✅ 로컬 서버 실행 중');
    return true;
  } catch (error) {
    console.log('❌ 로컬 서버가 실행되지 않았습니다.');
    console.log('   명령어: npm start 또는 func start');
    return false;
  }
}

// 메인 실행
(async () => {
  const isServerRunning = await checkServer();
  if (isServerRunning) {
    await runTests();
  }
})(); 