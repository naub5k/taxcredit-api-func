/**
 * 📊 개별 사업자번호 상세 테스트 (희성전자, 노들새마을금고 포함)
 * 목적: UNKNOWN_ERROR 상세 분석 및 요청/응답 구조 확인
 */

async function testIndividualCompanies() {
  console.log('🔍 개별 사업자번호 상세 테스트');
  console.log('🎯 목적: UNKNOWN_ERROR 상세 분석 및 요청/응답 구조 확인\n');
  
  // 5개 테스트 대상 (희성전자, 노들새마을금고 포함)
  const testCompanies = [
    { bizNo: '1068104152', name: '희성전자(주)', purpose: '이전 문제 사례' },
    { bizNo: '1088202313', name: '노들새마을금고', purpose: '오탐 방지 확인' },
    { bizNo: '1068100044', name: '궤도공영(주)', purpose: 'UNKNOWN_ERROR 분석' },
    { bizNo: '1068100516', name: '이연제약(주)', purpose: '성공 사례' },
    { bizNo: '1068100103', name: '나진산업(주)', purpose: 'UNKNOWN_ERROR 분석' }
  ];
  
  const results = [];
  
  for (let i = 0; i < testCompanies.length; i++) {
    const company = testCompanies[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${i+1}/5] 🏢 ${company.name} (${company.bizNo})`);
    console.log(`📋 테스트 목적: ${company.purpose}`);
    console.log('='.repeat(80));
    
    try {
      const apiUrl = 'https://taxcredit-api-func.azurewebsites.net/api/getPensionStatus';
      const requestBody = {
        bizNo: company.bizNo,
        wkplNm: company.name.replace(/\(주\)|\(합자\)|\(유\)/g, '').trim()
      };
      
      console.log(`📡 요청 URL: ${apiUrl}`);
      console.log(`📦 요청 헤더: Content-Type: application/json`);
      console.log(`📦 요청 본문:`, JSON.stringify(requestBody, null, 2));
      
      const startTime = Date.now();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
      console.log(`⏱️ 응답 시간: ${duration}ms`);
      
      // Raw 응답 텍스트 먼저 확인
      const responseText = await response.text();
      console.log(`📄 Raw 응답 (첫 500자):`);
      console.log(responseText.substring(0, 500));
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`📋 파싱된 JSON:`, JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.error(`❌ JSON 파싱 실패: ${parseError.message}`);
        result = { error: 'JSON 파싱 실패', rawResponse: responseText };
      }
      
      if (result.success) {
        console.log(`\n✅ 성공!`);
        console.log(`🏢 사업장명: ${result.data.workplaceName}`);
        console.log(`👥 가입자 수: ${result.data.subscriberCount}명`);
        console.log(`📅 기준년월: ${result.data.referenceYearMonth}`);
        console.log(`🔍 마스킹된 사업자번호: ${result.data.bzowrRgstNo}`);
        console.log(`⏱️ API 응답시간: ${result.data.responseTime}`);
        
        results.push({
          bizNo: company.bizNo,
          name: company.name,
          purpose: company.purpose,
          status: 'SUCCESS',
          responseName: result.data.workplaceName,
          subscriberCount: result.data.subscriberCount,
          responseTime: result.data.responseTime,
          duration: `${duration}ms`
        });
      } else {
        console.log(`\n❌ 실패!`);
        console.log(`오류: ${result.error}`);
        
        if (result.error && result.error.includes('UNKNOWN_ERROR')) {
          console.log(`\n🔍 UNKNOWN_ERROR 상세 분석:`);
          console.log(`- 입력 사업자번호: ${result.inputBizNo || company.bizNo}`);
          console.log(`- API 응답시간: ${result.responseTime || '미확인'}`);
          console.log(`- 요청 URL: ${apiUrl}`);
          console.log(`- 요청 파라미터:`, JSON.stringify(requestBody, null, 2));
        }
        
        results.push({
          bizNo: company.bizNo,
          name: company.name,
          purpose: company.purpose,
          status: 'FAILED',
          error: result.error,
          responseTime: result.responseTime || `${duration}ms`,
          duration: `${duration}ms`
        });
      }
      
    } catch (error) {
      console.error(`❌ 네트워크 오류: ${error.message}`);
      console.error(`스택 트레이스:`, error.stack);
      
      results.push({
        bizNo: company.bizNo,
        name: company.name,
        purpose: company.purpose,
        status: 'NETWORK_ERROR',
        error: error.message,
        duration: '오류로 측정 불가'
      });
    }
    
    // API 부하 방지
    if (i < testCompanies.length - 1) {
      console.log('\n⏳ 1초 대기 중...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 📊 최종 결과 요약
  console.log('\n' + '='.repeat(80));
  console.log('📊 개별 테스트 최종 결과 요약');
  console.log('='.repeat(80));
  
  console.log(`\n📋 결과 테이블:`);
  console.log('| 순번 | 회사명 | 사업자번호 | 상태 | 결과/오류 |');
  console.log('|------|--------|------------|------|-----------|');
  
  results.forEach((result, index) => {
    const statusIcon = result.status === 'SUCCESS' ? '✅' : 
                      result.status === 'FAILED' ? '❌' : '🔥';
    const resultText = result.status === 'SUCCESS' ? 
                      `${result.responseName} (${result.subscriberCount}명)` :
                      result.error.substring(0, 30) + '...';
    
    console.log(`| ${index + 1} | ${result.name} | ${result.bizNo} | ${statusIcon} ${result.status} | ${resultText} |`);
  });
  
  // UNKNOWN_ERROR 상세 분석
  const unknownErrors = results.filter(r => r.error && r.error.includes('UNKNOWN_ERROR'));
  if (unknownErrors.length > 0) {
    console.log(`\n🔍 UNKNOWN_ERROR 상세 분석 (${unknownErrors.length}건):`);
    unknownErrors.forEach(err => {
      console.log(`\n📋 ${err.name} (${err.bizNo}):`);
      console.log(`- 테스트 목적: ${err.purpose}`);
      console.log(`- 오류 메시지: ${err.error}`);
      console.log(`- 응답 시간: ${err.responseTime}`);
      console.log(`- 네트워크 시간: ${err.duration}`);
    });
  }
  
  return results;
}

testIndividualCompanies().catch(console.error); 