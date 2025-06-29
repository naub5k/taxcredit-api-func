/**
 * 🔍 폴백 전략 적용 후 최종 테스트
 * 현대자동차 (UNKNOWN_ERROR 해결 확인)
 * 올리브동물병원 (미가입 사업장 정상 처리 확인)
 */

async function testFallbackStrategy() {
  console.log('🚀 폴백 전략 적용 후 최종 테스트');
  
  const testCases = [
    {
      name: '현대자동차 (이전 UNKNOWN_ERROR)',
      bizNo: '1068100014',
      expectedResult: '성공 또는 적절한 오류 처리'
    },
    {
      name: '올리브동물병원 (국민연금 미가입)',
      bizNo: '1010777854',
      expectedResult: '존재하지 않습니다'
    },
    {
      name: '삼성전자 본사 (정상 케이스)',
      bizNo: '1248100998',
      expectedResult: '성공'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 테스트: ${testCase.name}`);
    console.log(`📋 사업자번호: ${testCase.bizNo}`);
    console.log(`📋 예상 결과: ${testCase.expectedResult}`);
    
    try {
      const url = `https://taxcredit-api-func.azurewebsites.net/api/getpensionstatus?bizNo=${testCase.bizNo}`;
      
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
        
        // 폴백 전략 성공 확인
        if (testCase.bizNo === '1068100014') {
          console.log('🎯 현대자동차 UNKNOWN_ERROR 해결 성공!');
        }
        
      } else if (response.status === 200 && !data.success) {
        console.log('⚠️ API 오류 응답:');
        console.log(`🚨 오류 메시지: ${data.error}`);
        
        // 오류 분석
        if (data.error.includes('UNKNOWN_ERROR')) {
          console.log('🔴 여전히 UNKNOWN_ERROR 발생 - 추가 수정 필요');
        } else if (data.error.includes('존재하지 않습니다')) {
          console.log('✅ 적절한 미가입 사업장 처리 (정상)');
          
          if (testCase.bizNo === '1010777854') {
            console.log('🎯 올리브동물병원 미가입 처리 정상!');
          }
        } else if (data.error.includes('1차/2차 시도 모두 실패')) {
          console.log('⚠️ 폴백 전략 실행 후 실패 - 공공데이터 이슈일 수 있음');
        } else {
          console.log('🔍 기타 오류:', data.error);
        }
        
      } else {
        console.log(`❌ HTTP ${response.status} 응답 - 예상치 못한 오류`);
      }
      
    } catch (error) {
      console.error(`❌ 네트워크 오류:`, error.message);
    }
    
    console.log('---');
  }
  
  console.log('\n📋 폴백 전략 평가:');
  console.log('1. 1차 시도: 부분 검색 (앞 6자리)');
  console.log('2. 2차 시도: 전체 검색 (1차 실패시)');
  console.log('3. 최종 결과: UNKNOWN_ERROR 대폭 감소 예상');
  console.log('');
  console.log('🎯 목표 달성 여부:');
  console.log('- 현대자동차 UNKNOWN_ERROR 해결: 확인 중...');
  console.log('- 올리브동물병원 적절한 처리: 확인 중...');
  console.log('- 삼성전자 정상 작동: 확인 중...');
}

// 실행
testFallbackStrategy().catch(console.error); 