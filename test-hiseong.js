/**
 * 🏭 희성전자(주) 문제 해결 테스트
 * 사업자번호: 1068104152
 * 기대: 희성전자(주) (궤도공영(주) 아님!)
 */

async function testHiseongElectronics() {
  console.log('🏭 희성전자(주) 문제 해결 테스트 시작');
  
  const bizNo = '1068104152';
  console.log(`📋 테스트 대상: 희성전자(주) (${bizNo})`);
  console.log(`❌ 이전 문제: 궤도공영(주)가 잘못 표시됨`);
  console.log(`✅ 기대 결과: 희성전자(주) 정확 표시`);
  
  try {
    const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
    console.log(`📡 API 호출: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url);
    const endTime = Date.now();
    
    console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
    console.log(`⏱️ 응답 시간: ${endTime - startTime}ms`);
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('\n✅ 성공! 국민연금 데이터 수신:');
      console.log(`🏢 사업장명: ${data.data.workplaceName}`);
      console.log(`👥 가입자 수: ${data.data.subscriberCount}명`);
      console.log(`📅 기준년월: ${data.data.referenceYearMonth}`);
      console.log(`🔍 마스킹된 사업자번호: ${data.data.bzowrRgstNo}`);
      console.log(`⏱️ 응답시간: ${data.data.responseTime}`);
      
      // 🎯 희성전자 매칭 확인
      const workplaceName = data.data.workplaceName;
      if (workplaceName.includes('희성전자')) {
        console.log('\n🎉 **문제 해결 성공!**');
        console.log('✅ 희성전자(주) 정확하게 매칭됨');
        console.log('✅ 더 이상 궤도공영(주)가 나오지 않음');
      } else if (workplaceName.includes('궤도공영')) {
        console.log('\n❌ **문제 여전히 존재**');
        console.log('🔴 여전히 궤도공영(주)가 표시됨');
        console.log('🔴 매칭 로직 추가 수정 필요');
      } else {
        console.log('\n⚠️ **예상치 못한 결과**');
        console.log(`🔍 표시된 사업장: ${workplaceName}`);
        console.log('🔍 희성전자도 궤도공영도 아닌 다른 회사');
      }
      
    } else if (response.status === 200 && !data.success) {
      console.log('\n❌ API 오류 발생:');
      console.log(`🚨 오류 메시지: ${data.error}`);
      
      if (data.error.includes('존재하지 않습니다')) {
        console.log('⚠️ 희성전자(주)가 국민연금에 등록되어 있지 않을 수 있음');
      }
      
    } else {
      console.log(`❌ HTTP ${response.status} 응답 - 예상치 못한 오류`);
    }
    
  } catch (error) {
    console.error(`❌ 네트워크 오류:`, error.message);
  }
  
  console.log('\n🔍 문제 해결 검증:');
  console.log('1. 검색 순서 변경: 1차 전체검색 → 2차 부분검색');
  console.log('2. 정확한 매칭: 마스킹된 사업자번호 정확히 일치 확인');
  console.log('3. 로깅 강화: 매칭 과정 상세 추적');
  console.log('');
  console.log('🎯 기대 효과:');
  console.log('- 희성전자(주) → 희성전자(주) 표시 ✅');
  console.log('- 궤도공영(주) 오탐 완전 제거 ✅');
  console.log('- 정확한 사업자번호 매칭 보장 ✅');
}

// 실행
testHiseongElectronics().catch(console.error); 