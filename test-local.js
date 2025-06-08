// 🧪 API 로컬 테스트 스크립트 - 🎯 **수정된 로직 검증**
const axios = require('axios').default;

const BASE_URL = 'http://localhost:7071/api';

console.log('🚀 Azure Functions 로컬 테스트 시작 (수정된 로직 검증)');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log('');

// 🎯 **테스트 케이스들** - getSampleList 제거됨
const tests = [
  {
    name: 'analyze 테스트 (하나엔지니어링)',
    url: `${BASE_URL}/analyze?bizno=1010818435`,
    method: 'GET'
  },
  {
    name: 'analyze 테스트 (존재하지 않는 사업자번호)',
    url: `${BASE_URL}/analyze?bizno=9999999999`,
    method: 'GET'
  }
];

// 🔍 **결과 검증 함수** - TaxCreditDashboard와 비교
function validateAnalysisResult(data, testName) {
  console.log(`🔍 ${testName} 결과 검증:`);
  
  if (!data.success) {
    console.log(`   ❌ API 오류: ${data.error}`);
    return false;
  }

  // 🏢 회사 정보 확인
  if (data.companyInfo) {
    console.log(`   🏢 회사명: ${data.companyInfo.companyName || data.companyInfo.bizno}`);
    console.log(`   📍 지역: ${data.companyInfo.region || '미분류'}`);
  }

  // 📊 인원 데이터 확인
  if (data.employeeData) {
    const years = Object.keys(data.employeeData).sort();
    console.log(`   👥 인원 데이터: ${years.length}년치 (${years[0]}~${years[years.length-1]})`);
    
    // 연도별 변화 확인
    for (let i = 1; i < Math.min(years.length, 4); i++) {
      const currentYear = years[i];
      const previousYear = years[i-1];
      const currentCount = data.employeeData[currentYear]?.total || 0;
      const previousCount = data.employeeData[previousYear]?.total || 0;
      const change = currentCount - previousCount;
      
      if (change !== 0) {
        const changeIcon = change > 0 ? '📈' : '📉';
        console.log(`   ${changeIcon} ${currentYear}: ${previousCount}명 → ${currentCount}명 (${change > 0 ? '+' : ''}${change}명)`);
      }
    }
  }

  // 💰 분석 결과 확인
  if (data.analysisResults) {
    console.log(`   📋 분석 결과: ${data.analysisResults.length}건`);
    
    let totalCredit = 0;
    let increaseYears = 0;
    let decreaseYears = 0;
    
    data.analysisResults.forEach(result => {
      if (result.changeType === 'increase') {
        increaseYears++;
        console.log(`   💚 ${result.baseYear}년: +${result.increaseCount}명 → ${(result.availableTotal || 0).toLocaleString()}원`);
        if (result.adjustedYouthCount > 0) {
          console.log(`      └ 청년: ${result.adjustedYouthCount}명, 기타: ${result.othersCount}명`);
        }
        totalCredit += result.availableTotal || 0;
      } else if (result.changeType === 'decrease') {
        decreaseYears++;
        console.log(`   🚨 ${result.baseYear}년: ${result.increaseCount}명 감소 → 환수위험`);
      }
    });
    
    console.log(`   📊 요약: 증가 ${increaseYears}년, 감소 ${decreaseYears}년`);
    console.log(`   💰 총 공제액: ${totalCredit.toLocaleString()}원`);
  }

  // 📈 요약 정보 확인
  if (data.summary) {
    console.log(`   📈 요약 총계: ${(data.summary.총계 || 0).toLocaleString()}원`);
  }

  return true;
}

// 테스트 실행
async function runTests() {
  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name} 테스트 중...`);
      
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: test.url,
        data: test.data,
        headers: test.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        timeout: 30000
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ 성공: ${response.status} (${duration}ms)`);
      
      if (response.data) {
        if (test.name.includes('analyze')) {
          // 분석 결과 상세 검증
          validateAnalysisResult(response.data, test.name);
        }
      }
      
    } catch (error) {
      console.log(`❌ 실패: ${error.message}`);
      if (error.response) {
        console.log(`   응답 코드: ${error.response.status}`);
        console.log(`   에러: ${error.response.data?.error || '상세 불명'}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`   💡 로컬 서버가 실행되지 않았을 수 있습니다. 'func start' 실행 확인`);
      }
    }
    
    console.log('─'.repeat(80));
  }
  
  console.log('🎯 모든 테스트 완료');
  console.log('');
  console.log('💡 다음 단계:');
  console.log('   1. TaxCreditDashboard와 결과값 비교');
  console.log('   2. 연도별 파라미터 동기화 확인'); 
  console.log('   3. Mock 데이터 → 실제 API 전환');
}

// 로컬 서버 확인 먼저
async function checkServer() {
  try {
    console.log('🔍 로컬 서버 상태 확인 중...');
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/admin/host/status`, { timeout: 10000 });
    console.log('✅ 로컬 Azure Functions 서버 실행 중');
    console.log('');
    return true;
  } catch (error) {
    console.log('❌ 로컬 서버가 실행되지 않았습니다.');
    console.log('   명령어: npm start 또는 func start');
    console.log('');
    return false;
  }
}

// 메인 실행
(async () => {
  const isServerRunning = await checkServer();
  if (isServerRunning) {
    await runTests();
  } else {
    console.log('🔄 서버 시작을 기다린 후 다시 실행해주세요.');
  }
})(); 