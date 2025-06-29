// Node.js 18+ 글로벌 fetch 사용

async function testNodeul() {
  console.log('🏦 노들새마을금고 정확 매칭 테스트');
  console.log('📋 사업자번호: 1088202313');
  console.log('📋 기대 결과: 노들새마을금고 (전국공공운수 아님)');
  
  const apiUrl = 'https://taxcredit-api-func.azurewebsites.net/api/getPensionStatus';
  const requestBody = {
    bizNo: '1088202313',
    wkplNm: '노들새마을금고'
  };
  
  try {
    console.log('📡 API 호출:', apiUrl);
    console.log('📦 요청 본문:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📊 응답 상태:', response.status);
    
    const result = await response.json();
    console.log('📋 전체 응답:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 성공!');
      console.log('🏢 사업장명:', result.data.workplaceName);
      console.log('👥 가입자 수:', result.data.subscriberCount + '명');
      console.log('📅 기준년월:', result.data.referenceYearMonth);
      
      if (result.data.workplaceName.includes('노들새마을금고')) {
        console.log('🎯 정확 매칭 성공! 노들새마을금고가 표시됨');
      } else {
        console.log('❌ 오탐 발생:', result.data.workplaceName);
      }
    } else {
      console.log('\n❌ 실패');
      console.log('오류:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 네트워크 오류:', error.message);
  }
}

testNodeul(); 