/**
 * 📊 국민연금 API 상위 10개 사업자번호 테스트
 * 목적: UNKNOWN_ERROR 발생 패턴 분석
 */

async function testTop10Companies() {
  console.log('🧪 상위 10개 사업자번호 국민연금 API 테스트');
  console.log('🎯 목적: UNKNOWN_ERROR vs 정상 응답 패턴 분석\n');
  
  // 상위 10개 사업자번호 (insu_clean DB 기준)
  const testCompanies = [
    { bizNo: '1068100011', name: '(주)아모레퍼시픽그룹' },
    { bizNo: '1068100044', name: '궤도공영(주)' },
    { bizNo: '1068100103', name: '나진산업(주)' },
    { bizNo: '1068100272', name: '미성상사(주)' },
    { bizNo: '1068100516', name: '이연제약(주)' },
    { bizNo: '1068100554', name: '이태원시장(주)' },
    { bizNo: '1068100710', name: '일성아이에스(주)' },
    { bizNo: '1068101140', name: '현대교역(주)' },
    { bizNo: '1068101174', name: '해밀톤관광(주)' },
    { bizNo: '1068104152', name: '희성전자(주)' }
  ];
  
  const results = [];
  
  for (let i = 0; i < testCompanies.length; i++) {
    const company = testCompanies[i];
    console.log(`\n[${i+1}/10] 🏢 ${company.name} (${company.bizNo})`);
    
    try {
      const apiUrl = 'https://taxcredit-api-func.azurewebsites.net/api/getPensionStatus';
      const requestBody = {
        bizNo: company.bizNo,
        wkplNm: company.name.replace(/\(주\)|\(합자\)|\(유\)/g, '').trim() // 괄호 제거
      };
      
      console.log(`📡 API 호출: ${requestBody.wkplNm}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ 성공: ${result.data.workplaceName} | 가입자 ${result.data.subscriberCount}명`);
        results.push({
          bizNo: company.bizNo,
          inputName: company.name,
          status: 'SUCCESS',
          responseName: result.data.workplaceName,
          subscriberCount: result.data.subscriberCount,
          responseTime: result.data.responseTime
        });
      } else {
        console.log(`❌ 실패: ${result.error}`);
        results.push({
          bizNo: company.bizNo,
          inputName: company.name,
          status: 'FAILED',
          error: result.error,
          responseTime: result.responseTime
        });
      }
      
      // API 부하 방지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ 네트워크 오류: ${error.message}`);
      results.push({
        bizNo: company.bizNo,
        inputName: company.name,
        status: 'ERROR',
        error: error.message
      });
    }
  }
  
  // 📊 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ API 실패: ${failedCount}개`);
  console.log(`🔥 네트워크 오류: ${errorCount}개`);
  
  console.log('\n📋 상세 결과:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.inputName} (${result.bizNo})`);
    console.log(`   상태: ${result.status}`);
    
    if (result.status === 'SUCCESS') {
      console.log(`   응답: ${result.responseName}`);
      console.log(`   가입자: ${result.subscriberCount}명`);
      console.log(`   응답시간: ${result.responseTime}`);
      
      // 매칭 정확도 확인
      const inputClean = result.inputName.replace(/\(주\)|\(합자\)|\(유\)/g, '').trim();
      const isAccurate = result.responseName.includes(inputClean) || inputClean.includes(result.responseName);
      console.log(`   매칭: ${isAccurate ? '✅ 정확' : '❌ 오탐'}`);
    } else {
      console.log(`   오류: ${result.error}`);
    }
  });
  
  // 🎯 패턴 분석
  console.log('\n🔍 UNKNOWN_ERROR 패턴 분석:');
  const unknownErrors = results.filter(r => r.error && r.error.includes('UNKNOWN_ERROR'));
  const notFoundErrors = results.filter(r => r.error && r.error.includes('존재하지 않습니다'));
  
  console.log(`📊 UNKNOWN_ERROR: ${unknownErrors.length}개`);
  console.log(`📊 사업장 없음: ${notFoundErrors.length}개`);
  
  if (unknownErrors.length > 0) {
    console.log('\n❌ UNKNOWN_ERROR 발생 회사:');
    unknownErrors.forEach(err => console.log(`   - ${err.inputName} (${err.bizNo})`));
  }
  
  if (notFoundErrors.length > 0) {
    console.log('\n⚠️ 사업장 없음 회사:');
    notFoundErrors.forEach(err => console.log(`   - ${err.inputName} (${err.bizNo})`));
  }
}

testTop10Companies().catch(console.error); 