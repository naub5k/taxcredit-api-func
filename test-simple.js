/**
 * 🔍 단순한 테스트 (500 오류 디버깅)
 */

async function testSimple() {
  console.log('🔍 단순 테스트 시작');
  
  const testCases = [
    '1248100998', // 삼성전자 (이전에 성공한 케이스)
    '1010777854', // 올리브동물병원 (존재하지 않는 케이스)
    '1068104152'  // 희성전자 (문제 케이스)
  ];
  
  for (const bizNo of testCases) {
    console.log(`\n🧪 테스트: ${bizNo}`);
    
    try {
      const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
      console.log(`📡 API 호출: ${url}`);
      
      const response = await fetch(url);
      console.log(`📊 응답 상태: ${response.status}`);
      
      if (response.status === 500) {
        const text = await response.text();
        console.log(`📄 500 오류 내용: ${text.substring(0, 200)}`);
      } else {
        const data = await response.json();
        
        if (data.success) {
          console.log(`✅ 성공: ${data.data.workplaceName}`);
        } else {
          console.log(`❌ 실패: ${data.error}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ 네트워크 오류: ${error.message}`);
    }
  }
}

// 실행
testSimple().catch(console.error); 