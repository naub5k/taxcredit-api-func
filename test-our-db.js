/**
 * 🔍 우리 내부 DB 확인 테스트
 * analyzeCompanyData API로 희성전자 존재 여부 확인
 */

async function testOurDB() {
  console.log('🏢 우리 내부 DB 확인 테스트');
  
  const bizNo = '1068104152';
  console.log(`📋 사업자번호: ${bizNo}`);
  
  try {
    // 우리 analyzeCompanyData API로 확인
    const url = `https://taxcredit-api-func.azurewebsites.net/api/analyzecompanydata?bizno=${bizNo}&page=1&pageSize=10`;
    console.log(`📡 우리 DB API 호출: ${url}`);
    
    const response = await fetch(url);
    console.log(`📊 응답 상태: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      
      if (data.success && data.companies && data.companies.length > 0) {
        console.log('\n✅ 우리 DB에 존재!');
        const company = data.companies[0];
        console.log(`🏢 사업장명: ${company.사업장명}`);
        console.log(`📋 사업자등록번호: ${company.사업자등록번호}`);
        console.log(`📍 주소: ${company.시도} ${company.구군}`);
        console.log(`🏭 업종: ${company.업종명}`);
        
        // 희성전자 확인
        if (company.사업장명.includes('희성전자')) {
          console.log('\n🎯 희성전자(주) 확인됨!');
          console.log('→ 국민연금 API에서 이 이름으로 검색해야 함');
        } else {
          console.log('\n❓ 다른 회사명:');
          console.log(`실제 회사명: "${company.사업장명}"`);
        }
        
      } else {
        console.log('\n❌ 우리 DB에 없음');
        console.log('→ 국민연금 검색 시 사업장명을 가져올 수 없음');
        console.log('→ 부분 검색(106810)으로 폴백');
      }
    } else {
      console.log(`❌ API 오류: ${response.status}`);
    }
    
  } catch (error) {
    console.error(`❌ 네트워크 오류: ${error.message}`);
  }
  
  console.log('\n💡 진단:');
  console.log('1. 우리 DB에 희성전자가 있으면 → 사업장명 검색이 작동해야 함');
  console.log('2. 우리 DB에 희성전자가 없으면 → 부분 검색 폴백이 정상');
  console.log('3. UNKNOWN_ERROR의 정확한 원인을 파악할 수 있음');
}

// 실행
testOurDB().catch(console.error); 