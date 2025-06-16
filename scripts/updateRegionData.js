const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// DB 연결 설정
const config = {
  server: process.env.DB_SERVER || 'naub5k.database.windows.net',
  user: process.env.DB_USER || 'naub5k',
  password: process.env.DB_PASS || 'dunkin3106UB!',
  database: process.env.DB_NAME || 'CleanDB',
  options: {
    encrypt: true,
    connectTimeout: 60000,
    requestTimeout: 60000
  }
};

// 시도-구군 매핑 검증 테이블 (올바른 매핑만 포함)
const validRegionMapping = {
  "서울특별시": ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
  "부산광역시": ["강서구", "금정구", "기장군", "남구", "동구", "동래구", "부산진구", "북구", "사상구", "사하구", "서구", "수영구", "연제구", "영도구", "중구", "해운대구"],
  "대구광역시": ["남구", "달서구", "달성군", "동구", "북구", "서구", "수성구", "중구", "군위군"],
  "인천광역시": ["계양구", "강화군", "남동구", "동구", "미추홀구", "부평구", "서구", "연수구", "옹진군", "중구"],
  "광주광역시": ["광산구", "남구", "동구", "북구", "서구"],
  "대전광역시": ["대덕구", "동구", "서구", "유성구", "중구"],
  "울산광역시": ["남구", "동구", "북구", "울주군", "중구"],
  "세종특별자치시": ["세종특별자치시"],
  "경기도": ["고양시", "과천시", "광명시", "광주시", "구리시", "군포시", "김포시", "남양주시", "동두천시", "부천시", "성남시", "수원시", "시흥시", "안산시", "안성시", "안양시", "양주시", "양평군", "여주시", "연천군", "오산시", "용인시", "의왕시", "의정부시", "이천시", "파주시", "평택시", "포천시", "하남시", "화성시", "가평군"],
  "강원도": ["강릉시", "고성군", "동해시", "삼척시", "속초시", "양구군", "양양군", "영월군", "원주시", "인제군", "정선군", "철원군", "춘천시", "태백시", "평창군", "홍천군", "화천군", "횡성군"],
  "충청북도": ["괴산군", "단양군", "보은군", "영동군", "옥천군", "음성군", "제천시", "증평군", "진천군", "청주시", "충주시"],
  "충청남도": ["계룡시", "공주시", "금산군", "논산시", "당진시", "보령시", "부여군", "서산시", "서천군", "아산시", "예산군", "천안시", "청양군", "태안군", "홍성군"],
  "전라북도": ["고창군", "군산시", "김제시", "남원시", "무주군", "부안군", "순창군", "완주군", "익산시", "임실군", "장수군", "전주시", "정읍시", "진안군"],
  "전라남도": ["강진군", "고흥군", "곡성군", "구례군", "나주시", "담양군", "목포시", "무안군", "보성군", "순천시", "신안군", "여수시", "영광군", "영암군", "완도군", "장성군", "장흥군", "진도군", "함평군", "해남군", "화순군", "광양시"],
  "경상북도": ["경산시", "경주시", "고령군", "구미시", "군위군", "김천시", "문경시", "봉화군", "상주시", "성주군", "안동시", "영덕군", "영양군", "영주시", "영천시", "예천군", "울릉군", "울진군", "의성군", "청도군", "청송군", "칠곡군", "포항시"],
  "경상남도": ["거제시", "거창군", "고성군", "김해시", "남해군", "밀양시", "사천시", "산청군", "양산시", "의령군", "진주시", "창녕군", "창원시", "통영시", "하동군", "함안군", "함양군", "합천군"],
  "제주특별자치도": ["서귀포시", "제주시"]
};

// 시도-구군 매핑 검증 함수
function isValidRegionMapping(sido, gugun) {
  if (!sido || !gugun) return false;
  
  const validGuguns = validRegionMapping[sido];
  if (!validGuguns) return false;
  
  return validGuguns.includes(gugun);
}

async function updateRegionData() {
  console.log('🔄 지역별 업체 수 데이터 업데이트 시작...');
  
  try {
    // DB 연결
    await sql.connect(config);
    console.log('✅ DB 연결 성공');

    // 1. 시도별 총 업체 수 조회 (내림차순 정렬) - 유효한 매핑만
    console.log('📊 시도별 업체 수 집계 중 (데이터 검증 포함)...');
    const sidoQuery = `
      SELECT 시도, COUNT(*) as 업체수
      FROM insu_clean 
      WHERE 시도 IS NOT NULL AND 시도 != ''
        AND 구군 IS NOT NULL AND 구군 != ''
      GROUP BY 시도
      ORDER BY COUNT(*) DESC
    `;
    
    const sidoResult = await sql.query(sidoQuery);
    console.log(`✅ 시도별 데이터 ${sidoResult.recordset.length}개 조회 완료`);

    // 2. 시도별 구군 데이터 조회 (검증된 매핑만)
    console.log('📊 시도별 구군 업체 수 집계 중 (매핑 검증 포함)...');
    const regionQuery = `
      SELECT 시도, 구군, COUNT(*) as 업체수
      FROM insu_clean 
      WHERE 시도 IS NOT NULL AND 시도 != '' 
        AND 구군 IS NOT NULL AND 구군 != ''
      GROUP BY 시도, 구군
      ORDER BY 시도, COUNT(*) DESC
    `;
    
    const regionResult = await sql.query(regionQuery);
    console.log(`✅ 구군별 데이터 ${regionResult.recordset.length}개 조회 완료`);

    // 3. 데이터 검증 및 필터링
    console.log('🔍 데이터 매핑 검증 중...');
    let validCount = 0;
    let invalidCount = 0;
    
    const validRegionData = regionResult.recordset.filter(item => {
      const isValid = isValidRegionMapping(item.시도, item.구군);
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`⚠️ 잘못된 매핑 제외: ${item.시도} - ${item.구군} (${item.업체수}개)`);
      }
      return isValid;
    });
    
    console.log(`✅ 매핑 검증 완료: 유효 ${validCount}개, 무효 ${invalidCount}개`);

    // 4. 검증된 데이터로 시도별 합계 재계산
    const verifiedRegionTotalData = [];
    
    for (const sidoData of sidoResult.recordset) {
      const 시도 = sidoData.시도;
      
      // 해당 시도의 유효한 구군 데이터만 합계
      const validTotal = validRegionData
        .filter(item => item.시도 === 시도)
        .reduce((sum, item) => sum + item.업체수, 0);
      
      if (validTotal > 0) {
        verifiedRegionTotalData.push({
          시도,
          업체수: validTotal
        });
      }
    }
    
    // 업체수 내림차순 정렬
    verifiedRegionTotalData.sort((a, b) => b.업체수 - a.업체수);

    // 5. 검증된 데이터로 지역별 구군 데이터 구성
    const employmentRegionData = [];
    
    for (const sidoData of verifiedRegionTotalData) {
      const 시도 = sidoData.시도;
      const 업체수 = sidoData.업체수;
      
      // 해당 시도의 유효한 구군 목록 추출
      const 구군목록 = validRegionData
        .filter(item => item.시도 === 시도)
        .map(item => ({
          구군: item.구군,
          업체수: item.업체수
        }))
        .sort((a, b) => b.업체수 - a.업체수); // 업체수 내림차순 정렬

      employmentRegionData.push({
        시도,
        업체수,
        구군목록
      });
    }

    // 6. 지역 그룹화 계산
    const regionGroups = {
      수도권: ["서울특별시", "경기도"],
      기타지역: verifiedRegionTotalData
        .filter(item => !["서울특별시", "경기도"].includes(item.시도))
        .map(item => item.시도)
    };

    // 기타지역 합계 계산
    const 기타지역합계 = verifiedRegionTotalData
      .filter(item => !["서울특별시", "경기도"].includes(item.시도))
      .reduce((sum, item) => sum + item.업체수, 0);

    // 7. 정규화된 비율 계산
    const normalizedRegionRatio = verifiedRegionTotalData
      .filter(region => !regionGroups.수도권.includes(region.시도))
      .map(region => ({
        시도: region.시도,
        업체수: region.업체수,
        비율: Number(((region.업체수 / 기타지역합계) * 100).toFixed(2))
      }))
      .sort((a, b) => b.비율 - a.비율);

    // 8. JavaScript 파일 생성
    console.log('📝 JavaScript 파일 생성 중...');
    
    const currentDate = new Date().toISOString().split('T')[0];
    const totalCount = verifiedRegionTotalData.reduce((sum, item) => sum + item.업체수, 0);
    
    const fileContent = `/**
 * 고용이력부 지역별 업체 수 데이터
 * - 시도별 구군 지역 정보와 해당 지역의 업체 수를 포함
 * - 요청서 기준: [CleanDB].CleanDB.dbo.Insu_Clean 테이블의 시도/구군 데이터 기반
 * - 마지막 업데이트: ${currentDate}
 * - 총 ${totalCount.toLocaleString()}개 업체 (검증된 매핑)
 * - 데이터 검증: 유효 ${validCount}개, 무효 ${invalidCount}개 제외
 */

// 시도별 총 업체 수 (정렬: 내림차순)
export const regionTotalData = ${JSON.stringify(verifiedRegionTotalData, null, 2)};

// 지역 그룹화 (서울+경기도, 기타지역)
export const regionGroups = ${JSON.stringify(regionGroups, null, 2)};

// 기타지역 합계 계산
export const 기타지역합계 = ${기타지역합계}; // 전체에서 서울+경기도 제외한 값

// 시도별 구군 데이터
export const employmentRegionData = ${JSON.stringify(employmentRegionData, null, 2)};

// 지역별 정규화된 비율 계산 (기타지역을 100%로 정규화)
export const normalizedRegionRatio = ${JSON.stringify(normalizedRegionRatio, null, 2)};

// 🔧 캐싱 지원 함수들
export const getRegionDataByKey = (sido, gugun = null) => {
  if (!gugun) {
    return employmentRegionData.find(region => region.시도 === sido);
  }
  
  const regionData = employmentRegionData.find(region => region.시도 === sido);
  if (!regionData) return null;
  
  const guguna = regionData.구군목록.find(g => g.구군 === gugun);
  return guguna ? { 시도: sido, ...guguna } : null;
};

export const getTotalCountBySido = (sido) => {
  const region = regionTotalData.find(r => r.시도 === sido);
  return region ? region.업체수 : 0;
};

export const getTotalCountByGugun = (sido, gugun) => {
  const data = getRegionDataByKey(sido, gugun);
  return data ? data.업체수 : 0;
};
`;

    // 9. 파일 저장
    const outputPath = path.join(__dirname, '../../taxcredit-visual/my-app/src/data/employmentRegionData.js');
    fs.writeFileSync(outputPath, fileContent, 'utf8');
    
    console.log(`✅ 파일 저장 완료: ${outputPath}`);
    console.log(`📊 업데이트 요약:`);
    console.log(`   - 시도: ${verifiedRegionTotalData.length}개`);
    console.log(`   - 총 업체 수: ${totalCount.toLocaleString()}개 (검증됨)`);
    console.log(`   - 수도권 업체: ${verifiedRegionTotalData.filter(item => regionGroups.수도권.includes(item.시도)).reduce((sum, item) => sum + item.업체수, 0).toLocaleString()}개`);
    console.log(`   - 기타지역 업체: ${기타지역합계.toLocaleString()}개`);
    console.log(`   - 데이터 품질: 유효 ${validCount}개, 무효 ${invalidCount}개 제외`);

    await sql.close();
    console.log('🎉 지역별 업체 수 데이터 업데이트 완료!');

  } catch (error) {
    console.error('❌ 업데이트 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  updateRegionData();
}

module.exports = updateRegionData; 