/**
 * 🔍 올리브동물병원 사업자번호 테스트
 * 사업자번호: 1010777854
 */

async function testOliveAnimalHospital() {
  console.log('🐾 올리브동물병원 테스트 시작');
  
  const bizNo = '1010777854';
  console.log(`🏥 테스트 대상: 올리브동물병원 (${bizNo})`);
  
  try {
    const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
    console.log(`📡 API 호출 URL: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url);
    const endTime = Date.now();
    
    console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
    console.log(`⏱️ 응답 시간: ${endTime - startTime}ms`);
    
    const data = await response.json();
    console.log(`📋 응답 데이터:`, JSON.stringify(data, null, 2));
    
    // 결과 분석
    if (response.status === 200 && data.success) {
      console.log('\n✅ 성공! 국민연금 데이터 수신:');
      console.log(`🏢 사업장명: ${data.data.workplaceName}`);
      console.log(`👥 가입자 수: ${data.data.subscriberCount}명`);
      console.log(`📅 기준년월: ${data.data.referenceYearMonth}`);
      console.log(`🔍 마스킹된 사업자번호: ${data.data.bzowrRgstNo}`);
      
      // 올리브동물병원인지 확인
      if (data.data.workplaceName.includes('올리브') || data.data.workplaceName.includes('동물병원')) {
        console.log('🎯 올리브동물병원 정확한 매칭 성공!');
      } else {
        console.log('⚠️ 다른 사업장이 매칭됨:', data.data.workplaceName);
      }
      
    } else if (response.status === 200 && !data.success) {
      console.log('\n❌ API 오류 발생:');
      console.log(`🚨 오류 메시지: ${data.error}`);
      
      // UNKNOWN_ERROR 여부 확인
      if (data.error.includes('UNKNOWN_ERROR') || data.error.includes('99')) {
        console.log('🔴 UNKNOWN_ERROR 여전히 발생 - 수정 필요!');
      }
      
    } else {
      console.log(`❌ HTTP ${response.status} 응답 - 예상치 못한 오류`);
    }
    
  } catch (error) {
    console.error(`❌ 네트워크 오류:`, error.message);
  }
  
  console.log('\n🔍 추가 디버깅 정보:');
  console.log(`   - 사업자번호: ${bizNo}`);
  console.log(`   - 앞 6자리: ${bizNo.substring(0, 6)}`);
  console.log(`   - 사업장명: 올리브동물병원`);
  console.log(`   - 소재지: 서울특별시 종로구`);
}

// 실행
testOliveAnimalHospital().catch(console.error); 