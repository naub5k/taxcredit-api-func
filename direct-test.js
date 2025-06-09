// �� Azure Functions 없이 핵심 계산 로직만 직접 테스트
console.log('🚀 핵심 계산 로직 직접 테스트 시작');

// 🔄 **Mock 데이터 생성** - TaxCreditDashboard의 샘플 데이터와 동일
const mockCompanyData = {
  사업자등록번호: '1234567890',
  사업장명: '좋은느낌',
  시도: '서울특별시',
  구군: '강남구',
  업종코드: '47911',
  // 연도별 인원 데이터 (TaxCreditDashboard와 동일)
  '2016': 8, '2017': 8, '2018': 8, '2019': 11, '2020': 15,
  '2021': 15, '2022': 15, '2023': 18, '2024': 8, '2025': 18
};

// 🎯 **연도별 파라미터** - TaxCreditDashboard와 동일한 테스트 케이스
const yearlyParams = {
  '2019': { youthCount: 2, socialInsurance: 120 },
  '2020': { youthCount: 1, socialInsurance: 100 },
  '2023': { youthCount: 0, socialInsurance: 150 }
};

// 📊 핵심 계산 함수들을 직접 import (DB 연결 부분 제외)
function testCalculationLogic() {
  console.log('📝 테스트 케이스:');
  console.log(`   🏢 회사: ${mockCompanyData.사업장명} (${mockCompanyData.사업자등록번호})`);
  console.log(`   📍 지역: ${mockCompanyData.시도} ${mockCompanyData.구군}`);
  console.log(`   🎛️ 연도별 파라미터:`, yearlyParams);
  console.log('');

  // 🧮 **TaxCreditDashboard와 동일한 계산 로직 직접 구현**
  
  // 지역 분류
  const 수도권지역 = ["서울특별시", "경기도", "인천광역시"];
  const region = 수도권지역.some(area => mockCompanyData.시도?.includes(area)) ? "수도권" : "수도권외";
  
  // 인원 데이터 변환
  const employeeData = {};
  // 🚨 **2020년부터 시작 (2019년 이전은 경정청구 기한 만료)**
  for (let year = 2020; year <= 2025; year++) {
    const yearStr = year.toString();
    const value = mockCompanyData[yearStr] || 0;
    employeeData[yearStr] = value;
  }
  
  console.log('👥 인원 데이터:', employeeData);
  console.log('📍 지역 분류:', region);
  console.log('');
  
  // 📈 **연도별 변화 분석 (TaxCreditDashboard와 동일)**
  const results = [];
  const years = Object.keys(employeeData).sort();
  const currentDate = new Date();
  
  for (let i = 1; i < years.length; i++) {
    const currentYear = years[i];
    const previousYear = years[i-1];
    const currentEmployees = employeeData[currentYear];
    const previousEmployees = employeeData[previousYear];
    const changeCount = currentEmployees - previousEmployees;
    
    console.log(`🔍 ${currentYear}년 분석:`, {
      이전인원: previousEmployees,
      현재인원: currentEmployees,
      변화: changeCount
    });
    
    // 📈 **증가한 경우 세액공제 계산**
    if (changeCount > 0) {
      // 🎯 **연도별 사용자 조정값 적용**
      const params = yearlyParams[currentYear] || {};
      const youthCount = params.youthCount || 0;
      const socialInsurance = params.socialInsurance || 120;
      const adjustedYouthCount = Math.min(youthCount, changeCount);
      const othersCount = changeCount - adjustedYouthCount;
      
      console.log(`   🎛️ 사용자 조정: 청년 ${adjustedYouthCount}명, 기타 ${othersCount}명, 사회보험료 ${socialInsurance}만원`);
      
      // 📅 경정청구 기한 계산 (TaxCreditDashboard와 동일)
      const baseYearNum = parseInt(currentYear);
      const deadlines = {
        year1: { year: baseYearNum, deadline: new Date(baseYearNum + 6, 4, 31) },
        year2: { year: baseYearNum + 1, deadline: new Date(baseYearNum + 7, 4, 31) },
        year3: { year: baseYearNum + 2, deadline: new Date(baseYearNum + 8, 4, 31) }
      };
      
      const year1Available = currentDate <= deadlines.year1.deadline;
      const year2Available = currentDate <= deadlines.year2.deadline;
      const year3Available = currentDate <= deadlines.year3.deadline;
      
      // 🧮 **세액공제 계산 (TaxCreditDashboard와 동일)**
      const youthRate = region === '수도권' ? 1100 : 1200;
      const othersRate = region === '수도권' ? 700 : 770;
      
      // 고용증대세액공제
      const employmentCreditPerYear = (adjustedYouthCount * youthRate + othersCount * othersRate) * 10000;
      
      // 사회보험료세액공제
      const youthSocialCredit = adjustedYouthCount * socialInsurance * 10000 * 1.0;
      const othersSocialCredit = othersCount * socialInsurance * 10000 * 0.5;
      const socialCreditPerYear = youthSocialCredit + othersSocialCredit;
      
      // 총 공제액
      const availableTotal = 
        (year1Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
        (year2Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
        (year3Available ? employmentCreditPerYear : 0);
      
      console.log(`   💰 고용증대: ${employmentCreditPerYear.toLocaleString()}원/년`);
      console.log(`   🛡️ 사회보험료: ${socialCreditPerYear.toLocaleString()}원/년`);
      console.log(`   📅 경정청구: ${year1Available ? 'Y' : 'N'}/${year2Available ? 'Y' : 'N'}/${year3Available ? 'Y' : 'N'}`);
      console.log(`   🎯 총 공제액: ${availableTotal.toLocaleString()}원`);
      
      results.push({
        baseYear: currentYear,
        increaseCount: changeCount,
        adjustedYouthCount,
        othersCount,
        changeType: 'increase',
        employmentCreditPerYear,
        socialCreditPerYear,
        availableTotal,
        year1Available,
        year2Available,
        year3Available
      });
      
    } else if (changeCount < 0) {
      console.log(`   🚨 ${Math.abs(changeCount)}명 감소 → 환수위험`);
      results.push({
        baseYear: currentYear,
        increaseCount: changeCount,
        changeType: 'decrease',
        availableTotal: 0
      });
    } else {
      console.log(`   📊 변화없음`);
      results.push({
        baseYear: currentYear,
        increaseCount: 0,
        changeType: 'none',
        availableTotal: 0
      });
    }
    console.log('');
  }
  
  // 📋 **요약 계산**
  const totalCredit = results.reduce((sum, result) => sum + (result.availableTotal || 0), 0);
  const increaseYears = results.filter(r => r.changeType === 'increase').length;
  const decreaseYears = results.filter(r => r.changeType === 'decrease').length;
  
  console.log('📊 최종 요약:');
  console.log(`   증가 연도: ${increaseYears}년`);
  console.log(`   감소 연도: ${decreaseYears}년`);
  console.log(`   총 공제액: ${totalCredit.toLocaleString()}원`);
  console.log('');
  
  // 🎯 **TaxCreditDashboard와 비교용 결과**
  console.log('🎯 TaxCreditDashboard 비교용 결과:');
  console.log('다음 값들이 TaxCreditDashboard와 일치해야 합니다:');
  results.forEach(result => {
    if (result.changeType === 'increase') {
      console.log(`${result.baseYear}년: ${result.availableTotal.toLocaleString()}원 (청년:${result.adjustedYouthCount}명, 기타:${result.othersCount}명)`);
    }
  });
  
  console.log('');
  console.log('✅ 핵심 로직 테스트 완료');
}

// 실행
testCalculationLogic(); 