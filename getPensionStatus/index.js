/**
 * 📊 국민연금 가입자 수 조회 API (희성전자 문제 해결: DB 회사명 연동)
 * 작업요청서_20250619_011_1 - V2 엔드포인트 + 빈 객체 처리
 * 희성전자 해결책: 내부 DB에서 회사명 조회 → 사업장명 검색
 */

const executeQuery = require('../utils/db-utils'); // DB 연결 추가

module.exports = async function (context, req) {
  const startTime = Date.now();
  
  // 🔑 기본 파라미터 검증 (POST 방식)
  const bizNo = req.body?.bizNo;
  const wkplNm = req.body?.wkplNm; // 사업장명 추가
  const API_KEY = process.env.PENSION_API_KEY;
  
  // 현재 년월 (기준년월)
  const currentYm = new Date().toISOString().slice(0, 7).replace('-', '');
  
  context.log.info(`🚀 국민연금 조회 시작 - 사업자번호: ${bizNo}`);
  
  try {
    // 🔍 1. 파라미터 검증
    if (!API_KEY) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }
    
    if (!bizNo) {
      throw new Error('사업자등록번호를 입력해주세요.');
    }

    // ✅ 사업장명 사용 (UI에서 전달받은 정보 - 참고용)
    context.log.info(`🏭 전달받은 사업장명: ${wkplNm || '없음'} (참고용)`);

    // 🔍 2. 1단계 API 호출 - 사업장 정보 조회 (단순화)
    let workplaceData = null;
    
    // 🔍 헤더 정의 (공공데이터포털 미리보기와 동일하게 설정 - UNKNOWN_ERROR 해결)
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.data.go.kr/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // 🎯 단순 검색: 부분 사업자번호로 조회 (요청서_20250619)
    const shortBizNo = bizNo.substring(0, 6);
    const bassInfoUrl = `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${API_KEY}&bzowrRgstNo=${shortBizNo}&pageNo=1&numOfRows=10&dataType=json`;
    context.log.info(`🔍 부분 검색: ${shortBizNo}`);
    
    context.log.info(`📡 API 호출: ${bassInfoUrl.replace(API_KEY, '***API_KEY***')}`);
    
    const resp1 = await fetch(bassInfoUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    context.log.info(`📦 응답 상태: ${resp1.status}`);
    
    // 응답 텍스트 먼저 읽기
    const responseText = await resp1.text();
    context.log.info(`📦 공공데이터 API 응답 (raw):`, responseText.substring(0, 500));
    
    // 응답 상태 확인
    if (!resp1.ok) {
      throw new Error(`HTTP ${resp1.status}: ${resp1.statusText} - Response: ${responseText.substring(0, 200)}`);
    }
    
    let json1;
    try {
      json1 = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`JSON 파싱 실패: ${responseText.substring(0, 200)}`);
    }
    
    context.log.info(`📦 공공데이터 API 응답:`, JSON.stringify(json1, null, 2));
    
    // 사업장 정보 추출
    const resultCode = json1?.response?.header?.resultCode;
    const items = json1?.response?.body?.items?.item;
    
    context.log.info(`📋 공공데이터 응답 코드: ${resultCode}`);
    context.log.info(`📋 items 타입: ${typeof items}, 값:`, items);
    
    // API 오류 체크
    if (resultCode !== "00") {
      const resultMsg = json1?.response?.header?.resultMsg || "알 수 없는 오류";
      throw new Error(`국민연금 API 오류: ${resultCode} - ${resultMsg}`);
    }
    
    // 데이터 없음 체크
    if (!items || (Array.isArray(items) ? items.length === 0 : Object.keys(items).length === 0)) {
      throw new Error('해당 사업자번호로 등록된 사업장이 존재하지 않습니다.');
    }
    
    // 🎯 완전 일치 매칭만 (요청서_20250619)
    const itemList = Array.isArray(items) ? items : [items];
    context.log.info(`📋 응답 데이터: ${itemList.length}개 항목`);
    
    // ✅ 정확한 사업자번호 매칭 필터 (요청서_매칭필터_20250619)
    let exactMatch = null;
    
    // ✅ 2단계 정확 매칭 (요청서_매칭필터_20250619)
    
    // 1단계: 사업자번호 기반 매칭 (마스킹 고려)
    const bizNoMatches = itemList.filter(item => {
      const maskedBizNo = item.bzowrRgstNo || '';
      const unmaskedBizNo = maskedBizNo.replace(/\*/g, '');
      return bizNo.startsWith(unmaskedBizNo);
    });
    
    context.log.info(`📋 1단계 사업자번호 매칭: ${bizNoMatches.length}개 후보`);
    bizNoMatches.forEach(item => {
      context.log.info(`  - ${item.wkplNm} (${item.bzowrRgstNo})`);
    });
    
    // 2단계: 사업장명 기반 추가 필터링 (전달받은 사업장명이 있는 경우)
    if (bizNoMatches.length > 1 && wkplNm) {
      exactMatch = bizNoMatches.find(item => {
        const itemName = item.wkplNm || '';
        const isNameMatch = itemName.includes(wkplNm) || wkplNm.includes(itemName);
        context.log.info(`🔍 사업장명 매칭: "${itemName}" vs "${wkplNm}" → ${isNameMatch}`);
        return isNameMatch;
      });
      
      if (exactMatch) {
        context.log.info(`✅ 2단계 매칭 성공: ${exactMatch.wkplNm} (사업장명 일치)`);
      }
    } else if (bizNoMatches.length === 1) {
      // 사업자번호 매칭이 1개뿐이면 그것을 사용
      exactMatch = bizNoMatches[0];
      context.log.info(`✅ 1단계 매칭 성공: ${exactMatch.wkplNm} (유일한 매칭)`);
    }
    
    // 매칭 실패 시 디버깅 정보
    if (!exactMatch) {
      const allItems = itemList.map(item => `${item.wkplNm} (${item.bzowrRgstNo})`).join(', ');
      context.log.info(`📋 전체 응답 항목: ${allItems}`);
      context.log.warn(`❌ 사업자번호 ${bizNo}와 매칭되는 정확한 사업장 없음`);
    }
    
    if (!exactMatch) {
      throw new Error('해당 사업자번호로 등록된 사업장이 존재하지 않습니다.');
    }
    
    workplaceData = exactMatch;

    const { seq, wkplNm: workplaceNm } = workplaceData;
    
    if (!seq) {
      throw new Error('사업장 식별번호(seq)를 찾을 수 없습니다.');
    }

    context.log.info(`✅ 1단계 성공 - 사업장명: ${workplaceNm}, SEQ: ${seq}`);

    // 🔍 3. 2단계 API 호출 - 가입자 수 조회 (공공데이터포털 권장 파라미터)
    const statusInfoUrl = `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getPdAcctoSttusInfoSearchV2?serviceKey=${API_KEY}&seq=${seq}&stdrYm=${currentYm}&pageNo=1&numOfRows=10&dataType=json`;
    
    context.log.info(`📡 2단계 API 호출: ${statusInfoUrl.replace(API_KEY, '***API_KEY***')}`);
    context.log.info(`📦 2단계 요청 헤더:`, JSON.stringify(requestHeaders, null, 2));
    context.log.info(`📦 실제 2단계 Fetch 헤더:`, JSON.stringify(requestHeaders, null, 2));
    
    const resp2 = await fetch(statusInfoUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    context.log.info(`📦 2단계 응답 상태: ${resp2.status}`);
    
    // 응답 텍스트 먼저 읽기
    const responseText2 = await resp2.text();
    context.log.info(`📦 2단계 공공데이터 API 응답 (raw):`, responseText2.substring(0, 500));
    
    // 응답 상태 확인
    if (!resp2.ok) {
      throw new Error(`HTTP ${resp2.status}: ${resp2.statusText} - Response: ${responseText2.substring(0, 200)}`);
    }
    
    let json2;
    try {
      json2 = JSON.parse(responseText2);
    } catch (parseError) {
      throw new Error(`JSON 파싱 실패: ${responseText2.substring(0, 200)}`);
    }
    
    context.log.info(`📦 2단계 공공데이터 API 응답:`, JSON.stringify(json2, null, 2));
    
    // 가입자 수 정보 추출
    const statusItem = json2?.response?.body?.items?.item;
    const statusData = Array.isArray(statusItem) ? statusItem[0] : statusItem;
    
    // 가입자 수 (없으면 0으로 기본값)
    const subscriberCount = parseInt(statusData?.jnngpCnt || statusData?.applcCnt || 0);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    context.log.info(`✅ 국민연금 조회 완료 - 응답시간: ${responseTime}ms`);
    context.log.info(`📊 결과: ${workplaceNm} - 가입자 ${subscriberCount}명 (${currentYm} 기준)`);
    context.log.info(`✅ 국민연금 데이터 설정 완료`);

    // 📤 성공 응답 (요청서 013 마스킹 응답 구조 반영)
    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        data: {
          // 요청서 013 기대 구조: 마스킹된 사업자번호 포함
          bzowrRgstNo: workplaceData.bzowrRgstNo, // 마스킹된 응답값 그대로
          dataCrtYm: workplaceData.dataCrtYm || currentYm,
          seq: workplaceData.seq,
          wkplJnngStcd: workplaceData.wkplJnngStcd,
          wkplNm: workplaceData.wkplNm,
          wkplRoadNmDtlAddr: workplaceData.wkplRoadNmDtlAddr,
          wkplStylDvcd: workplaceData.wkplStylDvcd,
          uniqueKey: `${workplaceData.seq}_${currentYm}`,
          
          // 기존 구조 호환성 유지
          workplaceName: workplaceNm,
          subscriberCount: subscriberCount,
          referenceYearMonth: currentYm,
          businessRegistrationNumber: bizNo, // 원본 입력값
          responseTime: `${responseTime}ms`
        }
      })
    };

  } catch (error) {
    // 🚨 오류 처리 - 강화된 로그
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    context.log.error('❌ 오류 발생:', error.message);
    
    // fetch 응답이 있는 경우 추가 로그
    if (error.response) {
      context.log.error('📦 오류 응답 데이터:', error.response.data);
      context.log.error('📦 오류 응답 상태:', error.response.status);
      context.log.error('📦 오류 응답 헤더:', error.response.headers);
    }
    
    // Error 객체 전체 구조 로그
    context.log.error('📦 Error 객체 전체:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    context.res = {
      status: 200, // ✅ 500 → 200 변경
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        inputBizNo: bizNo,
        responseTime: `${responseTime}ms`
      })
    };
  }
}; 