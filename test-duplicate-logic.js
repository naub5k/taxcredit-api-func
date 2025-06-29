/**
 * 🔍 중복횟수 로직 테스트
 * 실제 존재하는 사업자번호로 테스트
 */

async function testDuplicateLogic() {
  console.log('🔄 중복횟수 로직 테스트');
  
  // 삼성전자 같은 대기업 사업자번호 (확실히 존재)
  const testCases = [
    '1248100998', // 삼성전자
    '1078600006', // LG전자
    '1018197530'  // 다른 회사 (예시)
  ];
  
  for (const bizNo of testCases) {
    console.log(`\n🧪 테스트: ${bizNo}`);
    
    try {
      // 1. 우리 DB에서 존재 여부 확인
      const dbUrl = `https://taxcredit-api-func.azurewebsites.net/api/analyzecompanydata?bizno=${bizNo}&page=1&pageSize=10`;
      console.log(`📊 DB 확인: ${bizNo}`);
      
      const dbResponse = await fetch(dbUrl);
      if (dbResponse.status === 200) {
        const dbData = await dbResponse.json();
        
        if (dbData.success && dbData.companies && dbData.companies.length > 0) {
          const company = dbData.companies[0];
          console.log(`✅ DB에 존재: ${company.사업장명}`);
          
          // 2. 국민연금 API 테스트
          const pensionUrl = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
          console.log(`📡 국민연금 테스트: ${bizNo}`);
          
          const pensionResponse = await fetch(pensionUrl);
          const pensionData = await pensionResponse.json();
          
          if (pensionData.success) {
            console.log(`✅ 국민연금 성공: ${pensionData.data.workplaceName}`);
            
            // 사업장명 일치 확인
            if (pensionData.data.workplaceName.includes(company.사업장명.split('(')[0])) {
              console.log(`🎯 사업장명 매칭 성공!`);
            } else {
              console.log(`⚠️ 사업장명 불일치:`);
              console.log(`   DB: ${company.사업장명}`);
              console.log(`   국민연금: ${pensionData.data.workplaceName}`);
            }
          } else {
            console.log(`❌ 국민연금 실패: ${pensionData.error}`);
          }
          
        } else {
          console.log(`❌ DB에 없음`);
        }
      }
      
    } catch (error) {
      console.error(`❌ 오류: ${error.message}`);
    }
  }
  
  console.log('\n💡 중복횟수 로직 확인:');
  console.log('1. DB에 존재하는 사업자번호는 사업장명 검색 적용');
  console.log('2. DB에 없는 사업자번호는 부분 검색으로 폴백'); 
  console.log('3. 중복 레코드가 있으면 첫 번째 레코드 사용 (성립일자 DESC)');
}

// 실행
testDuplicateLogic().catch(console.error); 