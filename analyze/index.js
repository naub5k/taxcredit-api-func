const sql = require('mssql');
const executeQuery = require('../utils/db-utils'); // 검증된 db-utils 사용
const aiAnalysis = require('../utils/ai-analysis'); // AI 분석 모듈 추가

// ==================== 세액공제 분석 로직 (이관됨) ====================

// 🗺️ 지역 분류 (수도권 여부)
const classifyRegion = (sido) => {
  const 수도권지역 = ["서울특별시", "경기도", "인천광역시"];
  return 수도권지역.some(area => sido?.includes(area)) ? "수도권" : "수도권외";
};

// 🏭 업종 분류 (신성장서비스업 여부)
const classifyIndustry = (industryCode) => {
  const 신성장업종코드 = ["62", "63", "72"];
  return 신성장업종코드.includes(industryCode?.substring(0,2) || "") ? "신성장서비스업" : "일반업종";
};

// 📅 경정청구 기간 확인 (5년 기준)
const checkAmendmentEligibility = (targetYear, currentDate = new Date()) => {
  const filingDeadline = new Date(parseInt(targetYear) + 1, 2, 31);
  const amendmentDeadline = new Date(parseInt(targetYear) + 6, 2, 31);
  const isEligible = currentDate <= amendmentDeadline;
  
  return {
    isEligible,
    filingDeadline,
    amendmentDeadline,
    remainingDays: Math.max(0, Math.floor((amendmentDeadline - currentDate) / (1000 * 60 * 60 * 24))),
    status: isEligible ? "경정청구가능" : "기간만료"
  };
};

// 🛡️ 사후관리 기간 확인 (실제 인원 감소 여부 포함)
const checkPostManagementPeriod = (targetYear, creditType = "고용증대세액공제", currentDate = new Date()) => {
  const endDate = new Date(parseInt(targetYear), 11, 31);
  const managementPeriods = {
    "고용증대세액공제": 2,
    "사회보험료세액공제": 1
  };
  
  const managementEndDate = new Date(
    endDate.getFullYear() + managementPeriods[creditType], 
    11, 31
  );
  
  const isInManagementPeriod = currentDate <= managementEndDate;
  
  return {
    isInManagementPeriod,
    managementEndDate,
    remainingDays: Math.max(0, Math.floor((managementEndDate - currentDate) / (1000 * 60 * 60 * 24))),
    status: isInManagementPeriod ? "사후관리중" : "사후관리완료"
  };
};

// 🚨 사후관리 위반 감지: 실제 인원 감소 체크
const checkEmploymentMaintenanceViolation = (employeeData, targetYear, currentDate = new Date()) => {
  const targetYearInt = parseInt(targetYear);
  const currentYear = currentDate.getFullYear();
  
  // 사후관리 기간 확인
  const postMgmt = checkPostManagementPeriod(targetYear, "고용증대세액공제", currentDate);
  
  if (!postMgmt.isInManagementPeriod) {
    return { hasViolation: false, reason: "사후관리기간종료" };
  }
  
  // 증가 기준년도 인원수
  const baseYearEmployees = employeeData[targetYear] || 0;
  
  // 사후관리 기간 중 인원 감소 여부 체크
  for (let checkYear = targetYearInt + 1; checkYear <= currentYear; checkYear++) {
    const checkYearStr = checkYear.toString();
    const checkYearEmployees = employeeData[checkYearStr];
    
    if (checkYearEmployees !== undefined && checkYearEmployees < baseYearEmployees) {
      return {
        hasViolation: true,
        violationYear: checkYearStr,
        baseYearEmployees,
        currentEmployees: checkYearEmployees,
        decreaseCount: baseYearEmployees - checkYearEmployees,
        reason: `${checkYear}년 인원감소로 사후관리위반`
      };
    }
  }
  
  return { hasViolation: false, reason: "사후관리기간중_인원유지" };
};

// 🎯 3단계 위험도 상태 결정 (사후관리 위반 반영)
const determineRiskStatus = (targetYear, employeeData, currentDate = new Date()) => {
  const amendment = checkAmendmentEligibility(targetYear, currentDate);
  const postMgmtEmployment = checkPostManagementPeriod(targetYear, "고용증대세액공제", currentDate);
  const postMgmtSocial = checkPostManagementPeriod(targetYear, "사회보험료세액공제", currentDate);
  
  // 🚨 사후관리 위반 체크 추가
  const employmentViolation = checkEmploymentMaintenanceViolation(employeeData, targetYear, currentDate);
  
  const RISK_CLASSIFICATION = {
    IMMEDIATE_APPLICATION: { key: 'IMMEDIATE_APPLICATION', icon: '💚', title: '즉시신청' },
    CAREFUL_REVIEW: { key: 'CAREFUL_REVIEW', icon: '⚠️', title: '신중검토' },
    NOT_ELIGIBLE: { key: 'NOT_ELIGIBLE', icon: '❌', title: '신청불가' },
    RECAPTURE_RISK: { key: 'RECAPTURE_RISK', icon: '🚨', title: '추징대상' }  // 추가
  };
  
  if (!amendment.isEligible) {
    return {
      status: '기간경과미신청',
      classification: RISK_CLASSIFICATION.NOT_ELIGIBLE,
      amendment,
      postManagement: { employment: postMgmtEmployment, socialInsurance: postMgmtSocial },
      employmentViolation
    };
  } else if (employmentViolation.hasViolation) {
    // 🚨 사후관리 위반시 추징 상태
    return {
      status: '사후관리위반_추징대상',
      classification: RISK_CLASSIFICATION.RECAPTURE_RISK,
      amendment,
      postManagement: { employment: postMgmtEmployment, socialInsurance: postMgmtSocial },
      employmentViolation
    };
  } else if (!postMgmtEmployment.isInManagementPeriod && !postMgmtSocial.isInManagementPeriod) {
    return {
      status: '사후관리종료',
      classification: RISK_CLASSIFICATION.IMMEDIATE_APPLICATION,
      amendment,
      postManagement: { employment: postMgmtEmployment, socialInsurance: postMgmtSocial },
      employmentViolation
    };
  } else {
    return {
      status: '사후관리진행중',
      classification: RISK_CLASSIFICATION.CAREFUL_REVIEW,
      amendment,
      postManagement: { employment: postMgmtEmployment, socialInsurance: postMgmtSocial },
      employmentViolation
    };
  }
};

// 🔄 중복 적용 가능 여부 판단
const checkDuplicateEligibility = (targetYear) => {
  const year = parseInt(targetYear);
  
  if (year <= 2024) {
    return {
      isDuplicateAllowed: true,
      reason: "고용증대세액공제와 사회보험료세액공제 중복 적용 가능",
      applicableRule: "기존 제도 기준"
    };
  } else {
    return {
      isDuplicateAllowed: false,
      reason: "통합고용세액공제 도입으로 중복 적용 불가",
      applicableRule: "통합고용세액공제 기준"
    };
  }
};

// 💰 고용증대세액공제 계산
const calculateEmploymentCredit = (increaseCount, targetYear, region, youthRatio = 0) => {
  const EMPLOYMENT_CREDIT_RATES = {
    "2017": { "수도권": 600, "수도권외": 660 },
    "2018": { "수도권": 600, "수도권외": 660 },
    "2019": { "수도권": 700, "수도권외": 770 },
    "2020": { "수도권": 700, "수도권외": 770 },
    "2021": { "수도권": 700, "수도권외": 770 },
    "2022": { "수도권": 700, "수도권외": 770 },
    "2023": { "수도권": 850, "수도권외": 920 },
    "2024": { "수도권": 850, "수도권외": 920 }
  };
  
  const YOUTH_MULTIPLIER = {
    "수도권": 1.29,
    "수도권외": 1.30
  };
  
  const getYouthMultiplier = (year, region) => {
    const yearInt = parseInt(year);
    if (yearInt >= 2023) {
      return region === "수도권" ? 1.29 : 1.30;
    } else {
      return region === "수도권" ? 1.57 : 1.56;
    }
  };
  
  const rates = EMPLOYMENT_CREDIT_RATES[targetYear];
  if (!rates || !rates[region]) return 0;
  
  const baseRate = rates[region];
  const youthMultiplier = getYouthMultiplier(targetYear, region);
  
  const youthCount = Math.round(increaseCount * youthRatio);
  const othersCount = increaseCount - youthCount;
  
  const employmentCredit = (othersCount * baseRate * 10000) + 
                          (youthCount * baseRate * youthMultiplier * 10000);
  
  return Math.round(employmentCredit);
};

// 🛡️ 사회보험료세액공제 계산
const calculateSocialInsuranceCredit = (increaseCount, industry, youthRatio = 0, socialInsuranceRate = 1.0) => {
  const SOCIAL_INSURANCE_RATES = {
    "청년외_일반": 0.5,
    "청년외_신성장": 0.75,
    "청년등_배수": 2.0
  };
  
  const STANDARD_INSURANCE_PER_EMPLOYEE = 10;
  
  const isNewGrowthIndustry = industry === "신성장서비스업";
  const baseRate = isNewGrowthIndustry ? 
    SOCIAL_INSURANCE_RATES.청년외_신성장 : SOCIAL_INSURANCE_RATES.청년외_일반;
  
  const youthCount = Math.round(increaseCount * youthRatio);
  const othersCount = increaseCount - youthCount;
  
  const youthInsuranceCredit = youthCount * STANDARD_INSURANCE_PER_EMPLOYEE * SOCIAL_INSURANCE_RATES.청년등_배수;
  const othersInsuranceCredit = othersCount * STANDARD_INSURANCE_PER_EMPLOYEE * baseRate;
  
  const totalCredit = (youthInsuranceCredit + othersInsuranceCredit) * socialInsuranceRate * 10000;
  
  return Math.round(totalCredit);
};

// 📊 연도별 값 추출 헬퍼 함수
const getYearValue = (data, year) => {
  // [2024] 형태의 컬럼명도 지원
  const value = data[year] || data[`[${year}]`];
  return value !== null && value !== undefined ? parseInt(value) || 0 : 0;
};

// 📊 DB 데이터를 계산용 형태로 변환
const convertDbDataToCalculationFormat = (dbData) => {
  const region = classifyRegion(dbData.시도);
  const industry = classifyIndustry(dbData.업종코드);
  
  const employeeData = {};
  for (let year = 2016; year <= 2025; year++) {
    const yearStr = year.toString();
    const value = getYearValue(dbData, yearStr);
    
    employeeData[yearStr] = {
      total: value,
      youth: 0,
      others: value,
      socialInsurancePaid: value * 10
    };
  }
  
  return {
    companyInfo: {
      bizno: dbData.사업자등록번호,
      companyName: dbData.사업장명,
      companyType: "중소기업",
      region: region,
      industry: industry,
      industryCode: dbData.업종코드,
      sido: dbData.시도,
      gugun: dbData.구군,
      establishedDate: dbData.성립일자,
      exclusionStatus: dbData.제외여부
    },
    employeeData: employeeData
  };
};

// 📈 연도별 증감 계산
const calculateYearlyChanges = (employeeData) => {
  const years = Object.keys(employeeData).sort();
  const changes = {};
  
  for (let i = 1; i < years.length; i++) {
    const currentYear = years[i];
    const previousYear = years[i-1];
    
    const totalChange = employeeData[currentYear].total - employeeData[previousYear].total;
    
    changes[currentYear] = {
      totalChange: totalChange,
      youthChange: 0,
      othersChange: totalChange,
      isIncrease: totalChange > 0
    };
  }
  
  return changes;
};

// 📊 핵심: 세액공제 분석 실행 (메인 함수)
const analyzeCompanyTaxCredit = (companyInfo, youthRatio = 0, socialInsuranceRate = 1.0) => {
  if (!companyInfo) return { results: [], summary: { 기간경과미신청: 0, 사후관리종료: 0, 사후관리진행중: 0, 총계: 0 } };
  
  const { companyInfo: convertedCompanyInfo, employeeData } = convertDbDataToCalculationFormat(companyInfo);
  const employeeChanges = calculateYearlyChanges(employeeData);
  const currentDate = new Date();
  const results = [];
  
  // 2017년부터 2024년까지 분석
  for (let year = 2017; year <= 2024; year++) {
    const yearStr = year.toString();
    const change = employeeChanges[yearStr];
    
    if (!change || !change.isIncrease || change.totalChange <= 0) continue;
    
    const riskAnalysis = determineRiskStatus(yearStr, employeeData, currentDate);
    const duplicateRule = checkDuplicateEligibility(yearStr);
    
    let employmentCredit = 0;
    let socialInsuranceCredit = 0;
    let recaptureAmount = 0;  // 🚨 추징 금액 추가
    
    if (change.isIncrease && change.totalChange > 0) {
      // 기본 세액공제 계산
      employmentCredit = calculateEmploymentCredit(
        change.totalChange, 
        yearStr, 
        convertedCompanyInfo.region, 
        youthRatio
      );
      
      if (duplicateRule.isDuplicateAllowed) {
        socialInsuranceCredit = calculateSocialInsuranceCredit(
          change.totalChange, 
          convertedCompanyInfo.industry, 
          youthRatio, 
          socialInsuranceRate
        );
      }
      
      // 🚨 사후관리 위반시 추징 처리
      if (riskAnalysis.employmentViolation && riskAnalysis.employmentViolation.hasViolation) {
        // 전액 추징 (Good-feeling 사례: 2023년 2,550만원 추징)
        recaptureAmount = employmentCredit + socialInsuranceCredit;
        
        // 추징으로 인해 실질적인 세액공제는 0원
        const finalEmploymentCredit = 0;
        const finalSocialInsuranceCredit = 0;
        
        results.push({
          year: yearStr,
          increaseCount: change.totalChange,
          employmentCredit: finalEmploymentCredit,
          socialInsuranceCredit: finalSocialInsuranceCredit,
          totalCredit: 0,  // 추징으로 인해 0원
          originalCredit: employmentCredit + socialInsuranceCredit,  // 원래 공제액
          recaptureAmount,  // 추징 금액
          status: riskAnalysis.status,
          classification: riskAnalysis.classification,
          amendmentDeadline: riskAnalysis.amendment.amendmentDeadline.toLocaleDateString(),
          managementEndDate: riskAnalysis.postManagement.employment.managementEndDate.toLocaleDateString(),
          riskAnalysis,
          duplicateRule,
          violationInfo: riskAnalysis.employmentViolation  // 위반 상세 정보
        });
      } else {
        // 정상적인 세액공제 적용
        results.push({
          year: yearStr,
          increaseCount: change.totalChange,
          employmentCredit,
          socialInsuranceCredit,
          totalCredit: employmentCredit + socialInsuranceCredit,
          originalCredit: employmentCredit + socialInsuranceCredit,
          recaptureAmount: 0,
          status: riskAnalysis.status,
          classification: riskAnalysis.classification,
          amendmentDeadline: riskAnalysis.amendment.amendmentDeadline.toLocaleDateString(),
          managementEndDate: riskAnalysis.postManagement.employment.managementEndDate.toLocaleDateString(),
          riskAnalysis,
          duplicateRule,
          violationInfo: null
        });
      }
    }
  }
  
  // 요약 계산 (추징 반영)
  const summary = results.reduce((acc, result) => {
    // 추징 대상은 별도 분류
    if (result.status === '사후관리위반_추징대상') {
      if (!acc['사후관리위반_추징대상']) acc['사후관리위반_추징대상'] = 0;
      acc['사후관리위반_추징대상'] += result.recaptureAmount;  // 추징 금액으로 계산
    } else {
      acc[result.status] += result.totalCredit;
    }
    acc.총계 += result.totalCredit;  // 실제 적용 가능한 금액만 합계
    return acc;
  }, { 기간경과미신청: 0, 사후관리종료: 0, 사후관리진행중: 0, 총계: 0 });
  
  return { results, summary, companyInfo: convertedCompanyInfo };
};

// ==================== 메인 API 함수 ====================

module.exports = async function (context, req) {
    // 기본 시작 로깅 (운영환경에서도 최소한 유지)
    context.log('세액공제 분석 API 함수 시작');

    // CORS 헤더 설정
    const corsHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: {}
        };
        return;
    }

    try {
        // 파라미터 추출
        const bizno = req.query.bizno || (req.body && req.body.bizno);
        const youthRatio = parseFloat(req.query.youthRatio || (req.body && req.body.youthRatio) || 0);
        const socialInsuranceRate = parseFloat(req.query.socialInsuranceRate || (req.body && req.body.socialInsuranceRate) || 1.0);
        const includeAI = req.query.includeAI === 'true' || (req.body && req.body.includeAI === true);

        if (!bizno) {
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Missing bizno parameter',
                    message: '사업자등록번호(bizno)가 필요합니다.'
                }
            };
            return;
        }

        // 개발 환경에서만 상세 파라미터 로깅
        if (process.env.NODE_ENV === 'development') {
            context.log(`요청 파라미터: bizno=${bizno}, youthRatio=${youthRatio}, socialInsuranceRate=${socialInsuranceRate}`);
        }

        // DB 쿼리 실행
        const query = `SELECT * FROM insu_clean WHERE 사업자등록번호 = @bizno`;
        const params = [{ name: 'bizno', type: sql.VarChar, value: bizno }];

        const startTime = Date.now();
        const result = await executeQuery(query, params, context);
        const executionTime = Date.now() - startTime;

        if (!result.recordset || result.recordset.length === 0) {
            context.res = {
                status: 404,
                headers: corsHeaders,
                body: {
                    success: false,
                    bizno: bizno,
                    error: `사업자등록번호 ${bizno}에 대한 데이터가 없습니다.`
                }
            };
            return;
        }

        const companyData = result.recordset[0];
        
        // 🚀 핵심: 세액공제 분석 실행
        const analysisResult = analyzeCompanyTaxCredit(companyData, youthRatio, socialInsuranceRate);

        // AI 분석 (선택적)
        let aiAnalysisResult = null;
        if (includeAI) {
            try {
                aiAnalysisResult = aiAnalysis.performComprehensiveAnalysis(companyData);
            } catch (aiError) {
                context.log.error('AI 분석 오류:', aiError.message);
                aiAnalysisResult = { error: aiError.message };
            }
        }

        // 응답 구성
        const responseData = {
            success: true,
            bizno: bizno,
            mode: "full-analysis",
            queryInfo: {
                table: 'insu_clean',
                executionTime: `${executionTime}ms`,
                timestamp: new Date().toISOString()
            },
            data: companyData,
            analysisResult: analysisResult,
            ...(includeAI && { aiAnalysis: aiAnalysisResult })
        };

        context.log(`분석 완료: 총 공제액 ${analysisResult.summary.총계.toLocaleString()}원`);

        context.res = {
            status: 200,
            headers: corsHeaders,
            body: responseData
        };

    } catch (error) {
        context.log.error('❌ analyze 함수 오류:', error.stack);
        
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                success: false,
                bizno: req.query.bizno || (req.body && req.body.bizno) || 'unknown',
                error: '세액공제 분석 중 오류가 발생했습니다: ' + error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
}; 