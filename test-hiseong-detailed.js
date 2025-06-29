/**
 * 🔍 희성전자(주) 상세 테스트
 * 내부 DB → 사업장명 검색 과정 추적
 */

async function testHiseongDetailed() {
  console.log('🏭 희성전자(주) 상세 테스트');
  
  const bizNo = '1068104152';
  console.log(`📋 사업자번호: ${bizNo}`);
  
  try {
    const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${bizNo}`;
    console.log(`📡 API 호출: ${url}`);
    
    const response = await fetch(url);
    console.log(`📊 응답 상태: ${response.status}`);
    
    const data = await response.json();
    console.log(`📋 전체 응답:`, JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ 성공!');
      console.log(`🏢 사업장명: ${data.data.workplaceName}`);
      console.log(`🔍 마스킹된 사업자번호: ${data.data.bzowrRgstNo}`);
      
      // 희성전자 확인
      if (data.data.workplaceName.includes('희성전자')) {
        console.log('\n🎉 희성전자 매칭 성공!');
      } else {
        console.log('\n⚠️ 다른 회사가 매칭됨');
        console.log(`매칭된 회사: ${data.data.workplaceName}`);
      }
    } else {
      console.log('\n❌ 실패');
      console.log(`오류: ${data.error}`);
      
      if (data.error.includes('UNKNOWN_ERROR')) {
        console.log('\n🔍 UNKNOWN_ERROR 분석:');
        console.log('1. 내부 DB에서 "희성전자(주)" 조회 실패?');
        console.log('2. 사업장명 검색 API 호출 실패?');
        console.log('3. 부분 검색으로 폴백했지만 여전히 실패?');
      }
    }
    
  } catch (error) {
    console.error(`❌ 네트워크 오류: ${error.message}`);
  }
  
  console.log('\n💡 기대하는 동작:');
  console.log('1. 내부 DB 조회: 1068104152 → "희성전자(주)"');
  console.log('2. 사업장명 검색: wkplNm=희성전자');
  console.log('3. 응답: 12개 희성전자 항목 중 정확한 매칭');
  console.log('4. 결과: 희성전자(주) 표시');
}

// 실행
testHiseongDetailed().catch(console.error); 