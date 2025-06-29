/**
 * 🔍 국민연금 API 직접 테스트 (헤더 디버깅)
 * 회의록 0618_3 - SOAP Fault 문제 해결
 */

// Node.js 18+ 내장 fetch 사용

async function testPensionAPI() {
  console.log('🚀 국민연금 API 직접 테스트 시작');
  
  const API_KEY = process.env.PENSION_API_KEY;
  const bizNo = '5078800240'; // 중소기업 패턴 테스트
  
  if (!API_KEY) {
    console.error('❌ PENSION_API_KEY 환경변수가 설정되지 않았습니다.');
    return;
  }
  
  console.log('🔑 API 키 설정됨:', API_KEY.substring(0, 10) + '...');
  
  try {
    // URL 구성 (V2 파라미터 bzowrRgstNo 사용)
    const url = `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${API_KEY}&bzowrRgstNo=${bizNo}&pageNo=1&numOfRows=10&dataType=json`;
    
    console.log('📡 호출 URL:', url.replace(API_KEY, '***API_KEY***'));
    
    // 헤더 설정 (상세 User-Agent + 다양한 Accept)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*'
    };
    
    console.log('📦 요청 헤더:', JSON.stringify(headers, null, 2));
    
    // API 호출
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    console.log('📡 응답 상태:', response.status, response.statusText);
    console.log('📦 응답 헤더:', JSON.stringify(Object.fromEntries(response.headers), null, 2));
    
    // 응답 내용 확인
    const text = await response.text();
    console.log('📄 응답 내용 (첫 500자):', text.substring(0, 500));
    
    // JSON 파싱 시도
    try {
      const json = JSON.parse(text);
      console.log('✅ JSON 파싱 성공');
      console.log('📊 응답 구조:', JSON.stringify(json, null, 2));
    } catch (parseError) {
      console.log('❌ JSON 파싱 실패:', parseError.message);
      console.log('🔍 응답이 XML/SOAP인지 확인:', text.includes('<') ? 'XML/SOAP 응답' : '알 수 없는 형식');
    }
    
  } catch (error) {
    console.error('❌ 네트워크 오류:', error.message);
    console.error('🔍 오류 상세:', error);
  }
}

// 실행
testPensionAPI(); 