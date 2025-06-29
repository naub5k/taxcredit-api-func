/**
 * 🔍 올리브동물병원 공공데이터포털 직접 호출 테스트
 * 국민연금 DB에 실제로 존재하는지 확인
 */

async function testOliveDirectAPI() {
  console.log('🐾 올리브동물병원 공공데이터포털 직접 테스트');
  
  const API_KEY = 'yVgPIhBGrn7aoLE2a9ZRnIdUUF7DSC%2Fqx2w3qQhrL%2Fb9UcCNwOUNowpvBsAsk9QXsilv2g9AsB6JvMRYiBOAhg%3D%3D';
  const bizNo = '1010777854';
  const shortBizNo = bizNo.substring(0, 6); // 101077
  
  console.log(`🏥 테스트 대상: 올리브동물병원`);
  console.log(`📋 전체 사업자번호: ${bizNo}`);
  console.log(`📋 앞 6자리: ${shortBizNo}`);
  
  const testCases = [
    {
      name: '전체 사업자번호로 검색',
      param: `bzowrRgstNo=${bizNo}`
    },
    {
      name: '앞 6자리로 검색',
      param: `bzowrRgstNo=${shortBizNo}`
    },
    {
      name: '사업장명으로 검색',
      param: `wkplNm=${encodeURIComponent('올리브동물병원')}`
    },
    {
      name: '지역 + 사업장명 검색',
      param: `ldongAddrMgplDgCd=11&ldongAddrMgplSgguCd=110&wkplNm=${encodeURIComponent('올리브동물병원')}`
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`);
    
    try {
      const url = `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${API_KEY}&${testCase.param}&pageNo=1&numOfRows=10&dataType=json`;
      console.log(`📡 URL: ${url.replace(API_KEY, '***API_KEY***')}`);
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://www.data.go.kr/'
      };
      
      const response = await fetch(url, { headers });
      console.log(`📊 응답 상태: ${response.status}`);
      
      const text = await response.text();
      console.log(`📄 응답 텍스트 (첫 500자):`, text.substring(0, 500));
      
      const data = JSON.parse(text);
      const resultCode = data?.response?.header?.resultCode;
      const resultMsg = data?.response?.header?.resultMsg;
      const items = data?.response?.body?.items?.item;
      
      console.log(`📋 결과 코드: ${resultCode} - ${resultMsg}`);
      
      if (resultCode === "00" && items) {
        console.log(`✅ 성공! ${Array.isArray(items) ? items.length : 1}개 사업장 발견`);
        
        const itemList = Array.isArray(items) ? items : [items];
        itemList.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.wkplNm} (${item.bzowrRgstNo})`);
        });
        
        // 올리브동물병원 찾기
        const oliveMatch = itemList.find(item => 
          item.wkplNm?.includes('올리브') || 
          item.wkplNm?.includes('동물병원')
        );
        
        if (oliveMatch) {
          console.log(`🎯 올리브동물병원 발견: ${oliveMatch.wkplNm}`);
        }
        
      } else {
        console.log(`❌ 오류: ${resultCode} - ${resultMsg}`);
      }
      
    } catch (error) {
      console.error(`❌ 오류:`, error.message);
    }
    
    console.log('---');
  }
  
  console.log('\n🔍 결론:');
  console.log('1. 올리브동물병원이 국민연금 DB에 등록되어 있는지 확인');
  console.log('2. 등록되어 있다면 어떤 검색 방식이 효과적인지 파악');
  console.log('3. 우리 API 로직 수정 방향 결정');
}

// 실행
testOliveDirectAPI().catch(console.error); 