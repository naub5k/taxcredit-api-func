/**
 * 🔍 우리 API 디버깅
 * 왜 공공데이터에서는 UNKNOWN_ERROR인데 우리 API는 성공하는가?
 */

async function debugOurAPI() {
  console.log('🔍 우리 API 디버깅 시작');
  
  const bizNo = '1068104152';
  console.log(`📋 테스트: 희성전자(주) (${bizNo})`);
  console.log(`❓ 의문: 공공데이터는 UNKNOWN_ERROR인데 우리 API는 왜 성공?`);
  
  try {
    // Azure Functions 로그를 확인하기 위해 상세한 요청
    const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
    console.log(`📡 우리 API 호출: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url);
    const endTime = Date.now();
    
    console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
    console.log(`⏱️ 응답 시간: ${endTime - startTime}ms`);
    
    const data = await response.json();
    console.log(`📋 전체 응답 데이터:`, JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n🤔 성공 응답 분석:');
      console.log(`🏢 사업장명: ${data.data.workplaceName}`);
      console.log(`🔍 마스킹된 사업자번호: ${data.data.bzowrRgstNo}`);
      console.log(`📊 SEQ: ${data.data.seq}`);
      console.log(`⏱️ 응답시간: ${data.data.responseTime}`);
      
      // 분석
      if (data.data.workplaceName.includes('궤도공영')) {
        console.log('\n🚂 궤도공영 분석:');
        console.log('- 우리 API가 어떻게 궤도공영 데이터를 가져왔을까?');
        console.log('- 1차 전체 검색이 실패했는데도 성공한 이유는?');
        console.log('- 2차 부분 검색에서 성공한 것인가?');
        console.log('- 아니면 다른 로직이 작동한 것인가?');
      }
      
      if (data.data.workplaceName.includes('희성전자')) {
        console.log('\n🏭 희성전자 성공:');
        console.log('✅ 드디어 희성전자가 나왔습니다!');
      }
      
    } else {
      console.log('\n❌ 실패 응답:');
      console.log(`🚨 오류: ${data.error}`);
    }
    
  } catch (error) {
    console.error(`❌ 네트워크 오류:`, error.message);
  }
  
  console.log('\n🔍 추가 확인 사항:');
  console.log('1. Azure Functions 로그에서 실제 API 호출 과정 확인');
  console.log('2. 1차/2차 시도 중 어느 것이 성공했는지 확인');
  console.log('3. 매칭 로직에서 어떤 데이터를 선택했는지 확인');
  console.log('4. 캐싱이나 이전 호출 결과 영향 여부 확인');
}

// 실행
debugOurAPI().catch(console.error); 