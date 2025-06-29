/**
 * 🔍 희성전자(주) 공공데이터포털 직접 확인
 * 국민연금 DB에 실제로 존재하는지 검증
 */

async function testHiseongDirectAPI() {
  console.log('🏭 희성전자(주) 공공데이터포털 직접 확인');
  
  const API_KEY = 'yVgPIhBGrn7aoLE2a9ZRnIdUUF7DSC%2Fqx2w3qQhrL%2Fb9UcCNwOUNowpvBsAsk9QXsilv2g9AsB6JvMRYiBOAhg%3D%3D';
  const bizNo = '1068104152';
  const shortBizNo = bizNo.substring(0, 6); // 106810
  
  console.log(`🏭 테스트 대상: 희성전자(주)`);
  console.log(`📋 전체 사업자번호: ${bizNo}`);
  console.log(`📋 앞 6자리: ${shortBizNo}`);
  console.log(`❓ 궁금증: 희성전자가 정말 국민연금 DB에 있을까?`);
  
  const testCases = [
    {
      name: '1차: 전체 사업자번호로 검색',
      param: `bzowrRgstNo=${bizNo}`
    },
    {
      name: '2차: 앞 6자리로 검색',
      param: `bzowrRgstNo=${shortBizNo}`
    },
    {
      name: '3차: 사업장명으로 검색',
      param: `wkplNm=${encodeURIComponent('희성전자')}`
    },
    {
      name: '4차: 궤도공영 확인용',
      param: `bzowrRgstNo=1068100044`
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
      const totalCount = data?.response?.body?.totalCount;
      
      console.log(`📋 결과 코드: ${resultCode} - ${resultMsg}`);
      console.log(`📊 총 개수: ${totalCount}`);
      
      if (resultCode === "00" && items) {
        console.log(`✅ 성공! ${Array.isArray(items) ? items.length : 1}개 사업장 발견`);
        
        const itemList = Array.isArray(items) ? items : [items];
        itemList.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.wkplNm} (${item.bzowrRgstNo}) - SEQ: ${item.seq}`);
        });
        
        // 희성전자 또는 궤도공영 찾기
        const hiseongMatch = itemList.find(item => 
          item.wkplNm?.includes('희성전자')
        );
        const gudoMatch = itemList.find(item => 
          item.wkplNm?.includes('궤도공영')
        );
        
        if (hiseongMatch) {
          console.log(`🎯 희성전자 발견: ${hiseongMatch.wkplNm} (${hiseongMatch.bzowrRgstNo})`);
        }
        if (gudoMatch) {
          console.log(`🚂 궤도공영 발견: ${gudoMatch.wkplNm} (${gudoMatch.bzowrRgstNo})`);
        }
        
      } else {
        console.log(`❌ 오류: ${resultCode} - ${resultMsg}`);
      }
      
    } catch (error) {
      console.error(`❌ 오류:`, error.message);
    }
    
    console.log('---');
  }
  
  console.log('\n🔍 결론 도출:');
  console.log('1. 희성전자(주)가 국민연금 DB에 실제로 존재하는가?');
  console.log('2. 전체 검색에서 데이터가 나오지 않는 이유는?');
  console.log('3. 부분 검색에서 궤도공영이 먼저 나오는 이유는?');
  console.log('4. 우리 API 로직에서 놓친 부분은?');
}

// 실행
testHiseongDirectAPI().catch(console.error); 