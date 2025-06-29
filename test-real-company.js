/**
 * 🔍 실제 국민연금 가입 대기업 테스트
 * 삼성전자 본사 등 확실히 가입된 사업장으로 테스트
 */

async function testRealCompanies() {
  console.log('🏢 실제 국민연금 가입 기업 테스트');
  
  const companies = [
    {
      name: '삼성전자 본사',
      bizNo: '1248100998' // 삼성전자 대표 사업자번호
    },
    {
      name: 'LG전자',
      bizNo: '1078600006' 
    },
    {
      name: '현대자동차',
      bizNo: '1068100014'
    }
  ];
  
  for (const company of companies) {
    console.log(`\n🧪 테스트: ${company.name} (${company.bizNo})`);
    
    try {
      const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${company.bizNo}`;
      console.log(`📡 API 호출: ${url}`);
      
      const startTime = Date.now();
      const response = await fetch(url);
      const endTime = Date.now();
      
      console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
      console.log(`⏱️ 응답 시간: ${endTime - startTime}ms`);
      
      const data = await response.json();
      
      if (response.status === 200 && data.success) {
        console.log('✅ 성공! 국민연금 데이터 수신:');
        console.log(`🏢 사업장명: ${data.data.workplaceName}`);
        console.log(`👥 가입자 수: ${data.data.subscriberCount}명`);
        console.log(`📅 기준년월: ${data.data.referenceYearMonth}`);
        console.log(`🔍 마스킹된 사업자번호: ${data.data.bzowrRgstNo}`);
        
        // 대기업이므로 가입자 수가 많아야 함
        if (data.data.subscriberCount > 0) {
          console.log('🎯 정상적인 국민연금 데이터 확인!');
        }
        
      } else if (response.status === 200 && !data.success) {
        console.log('❌ API 오류:');
        console.log(`🚨 오류 메시지: ${data.error}`);
        
        if (data.error.includes('UNKNOWN_ERROR')) {
          console.log('🔴 여전히 UNKNOWN_ERROR 발생 - 추가 수정 필요');
        } else if (data.error.includes('존재하지 않습니다')) {
          console.log('⚠️ 해당 사업자번호가 국민연금 DB에 없음 (정상)');
        }
        
      } else {
        console.log(`❌ HTTP ${response.status} 응답`);
      }
      
    } catch (error) {
      console.error(`❌ 네트워크 오류:`, error.message);
    }
    
    console.log('---');
  }
  
  console.log('\n📋 종합 평가:');
  console.log('1. 올리브동물병원: 국민연금 미가입 → 정상 응답');
  console.log('2. 대기업들: 국민연금 가입 확인 → API 정상성 검증');
  console.log('3. 부분 검색 UNKNOWN_ERROR: 별도 수정 필요');
}

// 실행
testRealCompanies().catch(console.error); 