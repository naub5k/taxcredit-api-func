/**
 * 📊 국민연금 API 테스트 스크립트
 * 작업요청서_20250618_009 - 국민연금 UI 추가
 * 
 * 테스트 케이스:
 * 1. 정상적인 사업자번호로 조회
 * 2. 잘못된 사업자번호로 조회
 * 3. 파라미터 누락
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:7071/api';

async function testGetPensionStatus() {
  console.log('🚀 국민연금 API 테스트 시작\n');

  // 테스트 케이스 1: 정상적인 사업자번호
  await testCase1();
  
  // 테스트 케이스 2: 잘못된 사업자번호
  await testCase2();
  
  // 테스트 케이스 3: 파라미터 누락
  await testCase3();

  console.log('\n✅ 모든 테스트 완료');
}

// 🧪 테스트 케이스 1: 정상적인 사업자번호
async function testCase1() {
  console.log('🧪 테스트 케이스 1: 정상적인 사업자번호');
  
  try {
    const testBizNo = '1234567890'; // 테스트용 사업자번호
    const response = await axios.get(`${BASE_URL}/getPensionStatus?bizNo=${testBizNo}`, {
      timeout: 30000
    });

    console.log('📡 응답 상태:', response.status);
    console.log('📊 응답 데이터:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ 성공: 정상적으로 데이터를 조회했습니다.');
    } else {
      console.log('⚠️ 실패: API 오류 -', response.data.error);
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.response) {
      console.error('📡 응답 상태:', error.response.status);
      console.error('📊 응답 데이터:', error.response.data);
    }
  }
  console.log('---\n');
}

// 🧪 테스트 케이스 2: 잘못된 사업자번호
async function testCase2() {
  console.log('🧪 테스트 케이스 2: 잘못된 사업자번호');
  
  try {
    const testBizNo = '0000000000'; // 존재하지 않는 사업자번호
    const response = await axios.get(`${BASE_URL}/getPensionStatus?bizNo=${testBizNo}`, {
      timeout: 30000
    });

    console.log('📡 응답 상태:', response.status);
    console.log('📊 응답 데이터:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      console.log('✅ 예상된 실패: 올바르게 오류 처리되었습니다.');
    } else {
      console.log('⚠️ 예상치 못한 성공: 잘못된 사업자번호인데 성공했습니다.');
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.response) {
      console.error('📡 응답 상태:', error.response.status);
      console.error('📊 응답 데이터:', error.response.data);
    }
  }
  console.log('---\n');
}

// 🧪 테스트 케이스 3: 파라미터 누락
async function testCase3() {
  console.log('🧪 테스트 케이스 3: 파라미터 누락');
  
  try {
    const response = await axios.get(`${BASE_URL}/getPensionStatus`, {
      timeout: 10000
    });

    console.log('📡 응답 상태:', response.status);
    console.log('📊 응답 데이터:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success && response.data.error.includes('사업자등록번호')) {
      console.log('✅ 예상된 실패: 올바르게 파라미터 검증되었습니다.');
    } else {
      console.log('⚠️ 예상치 못한 결과');
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.response) {
      console.error('📡 응답 상태:', error.response.status);
      console.error('📊 응답 데이터:', error.response.data);
    }
  }
  console.log('---\n');
}

// 📊 실행
testGetPensionStatus().catch(console.error); 