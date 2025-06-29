/**
 * 🔍 배포된 Azure Function 테스트
 */

async function testDeployedFunction() {
  console.log('🚀 배포된 Azure Function 테스트 시작');
  
  const testCases = [
    {
      name: '정상 사업자번호',
      bizNo: '1248155381'
    },
    {
      name: '존재하지 않는 사업자번호',
      bizNo: '0000000000'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 테스트: ${testCase.name} (${testCase.bizNo})`);
    
    try {
      const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${testCase.bizNo}`;
      console.log(`📡 URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log(`📋 응답 데이터:`, JSON.stringify(data, null, 2));
      
      // 성공/실패 여부 확인
      if (response.status === 200) {
        console.log('✅ HTTP 200 응답 - 코드 수정 성공!');
        if (data.success) {
          console.log('✅ API 성공 응답');
        } else {
          console.log('⚠️ API 오류 응답:', data.error);
        }
      } else {
        console.log(`❌ HTTP ${response.status} 응답`);
      }
      
    } catch (error) {
      console.error(`❌ 테스트 오류:`, error.message);
    }
    
    console.log('---');
  }
  
  console.log('\n✅ 테스트 완료');
}

// 실행
testDeployedFunction().catch(console.error); 