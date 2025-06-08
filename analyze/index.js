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

// 💰 고용증대세액공제 계산 - 🎯 **TaxCreditDashboard와 동일한 로직으로 수정**
const calculateEmploymentCredit = (increaseCount, targetYear, region, adjustedYouthCount = 0, othersCount = 0) => {
  // 🧮 **검증된 TaxCreditDashboard 로직 사용**
  const youthRate = region === '수도권' ? 1100 : 1200;
  const othersRate = region === '수도권' ? 700 : 770;
  
  // 고용증대세액공제 계산 (만원 단위)
  const employmentCreditPerYear = (adjustedYouthCount * youthRate + othersCount * othersRate) * 10000;
  
  return Math.round(employmentCreditPerYear);
};

// 🛡️ 사회보험료세액공제 계산 - 🎯 **TaxCreditDashboard와 동일한 로직으로 수정**
const calculateSocialInsuranceCredit = (adjustedYouthCount, othersCount, socialInsurance = 120) => {
  // 🧮 **검증된 TaxCreditDashboard 로직 사용**
  const youthSocialCredit = adjustedYouthCount * socialInsurance * 10000 * 1.0;
  const othersSocialCredit = othersCount * socialInsurance * 10000 * 0.5;
  const socialCreditPerYear = youthSocialCredit + othersSocialCredit;
  
  return Math.round(socialCreditPerYear);
};

// 📅 경정청구 기한 계산 - 🎯 **TaxCreditDashboard와 동일한 로직으로 수정**
const getAmendmentDeadlines = (year) => {
  const baseYearNum = parseInt(year);
  return {
    year1: { year: baseYearNum, deadline: new Date(baseYearNum + 6, 4, 31) },
    year2: { year: baseYearNum + 1, deadline: new Date(baseYearNum + 7, 4, 31) },
    year3: { year: baseYearNum + 2, deadline: new Date(baseYearNum + 8, 4, 31) }
  };
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

// 📊 핵심: 세액공제 분석 실행 (메인 함수) - 🎯 **TaxCreditDashboard와 동일한 로직으로 수정**
const analyzeCompanyTaxCredit = (companyInfo, yearlyParams = {}) => {
  if (!companyInfo) return { 
    results: [], 
    summary: { 기간경과미신청: 0, 사후관리종료: 0, 사후관리진행중: 0, 총계: 0 },
    companyInfo: {},
    employeeData: {}
  };
  
  const { companyInfo: convertedCompanyInfo, employeeData } = convertDbDataToCalculationFormat(companyInfo);
  const currentDate = new Date();
  const results = [];
  
  // 🔍 employeeData에서 연도별 변화 분석 (TaxCreditDashboard 로직과 동일)
  const years = Object.keys(employeeData).sort();
  console.log('🔍 분석할 years:', years);
  
  for (let i = 1; i < years.length; i++) {
    const currentYear = years[i];
    const previousYear = years[i-1];
    const currentEmployees = employeeData[currentYear]?.total || 0;
    const previousEmployees = employeeData[previousYear]?.total || 0;
    const changeCount = currentEmployees - previousEmployees;
    
    console.log(`🔍 ${currentYear}년 분석:`, {
      currentYear,
      previousYear,
      currentEmployees,
      previousEmployees,
      changeCount
    });
    
    // 📈 **증가한 경우에만 세액공제 계산**
    if (changeCount > 0) {
      // 🎯 **연도별 사용자 조정값 적용**
      const params = yearlyParams[currentYear] || {};
      const youthCount = params.youthCount || 0;
      const socialInsurance = params.socialInsurance || 120;
      const adjustedYouthCount = Math.min(youthCount, changeCount);
      const othersCount = changeCount - adjustedYouthCount;
      
      console.log(`🔄 ${currentYear}년 사용자 조정값:`, { 
        youthCount, 
        socialInsurance,
        adjustedYouthCount,
        othersCount 
      });
      
      // 📅 경정청구 기한 계산
      const deadlines = getAmendmentDeadlines(currentYear);
      const year1Available = currentDate <= deadlines.year1.deadline;
      const year2Available = currentDate <= deadlines.year2.deadline;
      const year3Available = currentDate <= deadlines.year3.deadline;
      
      // 🧮 **세액공제 계산 (TaxCreditDashboard와 동일)**
      const employmentCreditPerYear = calculateEmploymentCredit(
        changeCount, 
        currentYear, 
        convertedCompanyInfo.region, 
        adjustedYouthCount, 
        othersCount
      );
      
      const socialCreditPerYear = calculateSocialInsuranceCredit(
        adjustedYouthCount, 
        othersCount, 
        socialInsurance
      );
      
      // 🚨 사후관리 상태 분석
      const postManagementStatus = analyzePostManagementStatus(employeeData, currentYear);
      
      // 📋 결과 저장 (TaxCreditDashboard 형식과 동일)
      results.push({
        year: currentYear,
        baseYear: currentYear,
        increaseCount: changeCount,
        adjustedYouthCount,
        othersCount,
        changeType: 'increase',
        employmentCredit: {
          year1: { amount: year1Available ? employmentCreditPerYear : 0, available: year1Available },
          year2: { amount: year2Available ? employmentCreditPerYear : 0, available: year2Available },
          year3: { amount: year3Available ? employmentCreditPerYear : 0, available: year3Available }
        },
        socialCredit: {
          year1: { amount: year1Available ? socialCreditPerYear : 0, available: year1Available },
          year2: { amount: year2Available ? socialCreditPerYear : 0, available: year2Available }
        },
        deadlines,
        availableTotal: 
          (year1Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
          (year2Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
          (year3Available ? employmentCreditPerYear : 0),
        postManagementStatus,
        // 기존 호환성을 위한 필드들
        totalCredit: (year1Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
                    (year2Available ? employmentCreditPerYear + socialCreditPerYear : 0) +
                    (year3Available ? employmentCreditPerYear : 0),
        status: postManagementStatus?.status || '분석완료',
        classification: postManagementStatus?.classification || { icon: '📊', title: '분석완료' }
      });
    }
    // 📉 **감소한 경우 환수 위험 분석**
    else if (changeCount < 0) {
      // 환수 위험 계산 로직 (TaxCreditDashboard와 동일)
      const recallRisk = calculateRecallRisk(results, currentYear, Math.abs(changeCount));
      
      results.push({
        year: currentYear,
        baseYear: currentYear,
        increaseCount: changeCount,
        adjustedYouthCount: 0,
        othersCount: 0,
        changeType: 'decrease',
        employmentCredit: { year1: { amount: 0, available: false }, year2: { amount: 0, available: false }, year3: { amount: 0, available: false } },
        socialCredit: { year1: { amount: 0, available: false }, year2: { amount: 0, available: false } },
        deadlines: null,
        availableTotal: 0,
        totalCredit: 0,
        recallRisk,
        postManagementStatus: {
          status: '환수위험',
          confidence: '위험',
          icon: '🚨',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          description: `${Math.abs(changeCount)}명 감소로 인한 환수 위험`,
          isRisky: true,
          decreaseCount: Math.abs(changeCount)
        },
        status: '환수위험',
        classification: { icon: '🚨', title: '추징대상' }
      });
    }
    // 📊 **변화 없음(0명)**
    else if (changeCount === 0) {
      results.push({
        year: currentYear,
        baseYear: currentYear,
        increaseCount: 0,
        adjustedYouthCount: 0,
        othersCount: 0,
        changeType: 'none',
        employmentCredit: { year1: { amount: 0, available: false }, year2: { amount: 0, available: false }, year3: { amount: 0, available: false } },
        socialCredit: { year1: { amount: 0, available: false }, year2: { amount: 0, available: false } },
        deadlines: null,
        availableTotal: 0,
        totalCredit: 0,
        postManagementStatus: {
          status: '변화없음',
          confidence: '안전',
          icon: '📊',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          description: '인원 변화 없음 - 세액공제 해당 없음',
          isRisky: false
        },
        status: '변화없음',
        classification: { icon: '📊', title: '변화없음' }
      });
    }
  }
  
  // 📋 요약 계산
  const summary = results.reduce((acc, result) => {
    const status = result.status || '기타';
    if (!acc[status]) acc[status] = 0;
    acc[status] += result.totalCredit || 0;
    acc.총계 += result.totalCredit || 0;
    return acc;
  }, { 기간경과미신청: 0, 사후관리종료: 0, 사후관리진행중: 0, 총계: 0 });
  
  return { 
    results, 
    summary, 
    companyInfo: convertedCompanyInfo,
    employeeData
  };
};

// 🚨 **사후관리 상태 분석 함수** - 🎯 **TaxCreditDashboard와 동일**
const analyzePostManagementStatus = (employeeData, baseYear) => {
  const currentYear = new Date().getFullYear();
  const baseYearNum = parseInt(baseYear);
  const postManagementEndYear = baseYearNum + 2; // 3년간 사후관리 (기준연도 포함)
  
  // 사후관리 상태 결정
  let status = '';
  let confidence = '';
  let icon = '';
  let bgColor = '';
  let textColor = '';
  let description = '';
  
  if (postManagementEndYear < currentYear) {
    // 사후관리 완료 (확실함)
    status = '사후관리완료';
    confidence = '확실함';
    icon = '💚';
    bgColor = 'bg-green-100';
    textColor = 'text-green-800';
    description = `${postManagementEndYear}년 완료 - 안전한 세액공제`;
  } else if (postManagementEndYear === currentYear) {
    // 사후관리 마지막 해 (2024년 데이터 영향)
    status = '사후관리진행중';
    confidence = '불확실';
    icon = '⚠️';
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
    description = `${currentYear}년 데이터 확인 필요 - 정확도 주의`;
  } else {
    // 사후관리 미완료 (미래 데이터 필요)
    status = '사후관리미완료';
    confidence = '불확실';
    icon = '❓';
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-800';
    description = `${postManagementEndYear}년까지 인원 유지 필요`;
  }
  
  // 실제 인원 감소 체크 (데이터가 있는 경우에만)
  const riskDetails = [];
  if (employeeData && Object.keys(employeeData).length > 0) {
    const years = Object.keys(employeeData).sort();
    const baseYearIndex = years.indexOf(baseYear);
    
    // 기준년도 이후 사후관리 기간 체크
    for (let i = baseYearIndex + 1; i < Math.min(baseYearIndex + 3, years.length); i++) {
      const checkYear = years[i];
      const previousYear = years[i-1];
      const currentEmployees = employeeData[checkYear]?.total || 0;
      const previousEmployees = employeeData[previousYear]?.total || 0;
      const change = currentEmployees - previousEmployees;
      
      if (change < 0) { // 인원 감소 발견
        riskDetails.push({
          year: checkYear,
          decrease: Math.abs(change),
          currentEmployees,
          previousEmployees,
          riskLevel: Math.abs(change) > 2 ? 'HIGH' : 'MEDIUM'
        });
      }
    }
  }
  
  // 실제 위험 발견 시 상태 업데이트
  if (riskDetails.length > 0) {
    status = '추징위험';
    confidence = '위험';
    icon = '🚨';
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
    description = `인원 감소로 인한 추징 위험`;
  }
  
  return {
    status,
    confidence,
    icon,
    bgColor,
    textColor,
    description,
    postManagementEndYear,
    riskDetails,
    isRisky: riskDetails.length > 0,
    totalDecrease: riskDetails.reduce((sum, risk) => sum + risk.decrease, 0)
  };
};

// 🚨 **환수 위험 계산 함수** - 🎯 **TaxCreditDashboard와 동일**
const calculateRecallRisk = (previousResults, decreaseYear, decreaseCount) => {
  const decreaseYearNum = parseInt(decreaseYear);
  const recallTargets = [];
  
  // 감소 연도부터 3년 전까지의 증가분 찾기
  for (let i = decreaseYearNum - 1; i >= decreaseYearNum - 3; i--) {
    const targetResult = previousResults.find(r => parseInt(r.baseYear) === i && r.changeType === 'increase');
    if (targetResult) {
      recallTargets.push({
        year: i.toString(),
        increaseCount: targetResult.increaseCount,
        employmentCredit: targetResult.employmentCredit,
        socialCredit: targetResult.socialCredit,
        estimatedRecallAmount: targetResult.availableTotal // 간단 추정
      });
    }
  }
  
  return {
    decreaseYear,
    decreaseCount,
    recallTargets,
    totalRecallAmount: recallTargets.reduce((sum, target) => sum + target.estimatedRecallAmount, 0),
    description: `${decreaseYear}년 ${decreaseCount}명 감소로 인해 ${recallTargets.length}년치 세액공제 환수 위험`
  };
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
        // 파라미터 추출 - 🎯 **연도별 파라미터 지원**
        const bizno = req.query.bizno || (req.body && req.body.bizno);
        const recordId = req.query.recordId || (req.body && req.body.recordId); // 🔥 **특정 레코드 ID 지원 추가**
        const youthRatio = parseFloat(req.query.youthRatio || (req.body && req.body.youthRatio) || 0);
        const socialInsuranceRate = parseFloat(req.query.socialInsuranceRate || (req.body && req.body.socialInsuranceRate) || 120);
        const includeAI = req.query.includeAI === 'true' || (req.body && req.body.includeAI === true);
        
        // 🎯 **연도별 파라미터 지원 추가** - TaxCreditDashboard와 동일
        const yearlyParams = req.body && req.body.yearlyParams ? req.body.yearlyParams : {};

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
            context.log(`요청 파라미터: bizno=${bizno}, recordId=${recordId}, youthRatio=${youthRatio}, socialInsuranceRate=${socialInsuranceRate}`);
            context.log(`연도별 파라미터:`, yearlyParams);
        }

        // 🔄 **중복횟수 처리: 모든 레코드 조회**
        const query = `SELECT *, ROW_NUMBER() OVER (ORDER BY 성립일자 DESC, 업종코드) as recordId FROM insu_clean WHERE 사업자등록번호 = @bizno ORDER BY 성립일자 DESC, 업종코드`;
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

        // 🚀 **중복횟수 2 이상인 경우 업종 선택 처리**
        const duplicateCount = result.recordset.length;
        context.log(`📊 중복횟수: ${duplicateCount}개 레코드 발견`);
        context.log(`🔍 디버깅 - recordId: ${recordId}, duplicateCount: ${duplicateCount}`);
        context.log(`🔍 조건 확인: !recordId = ${!recordId}, duplicateCount >= 2 = ${duplicateCount >= 2}`);

        // recordId가 없고 중복횟수가 2 이상인 경우 업종 선택 옵션 반환
        if (!recordId && duplicateCount >= 2) {
            context.log(`🎯 중복 처리 로직 실행됨!`);
            const industryOptions = result.recordset.map((record, index) => ({
                id: record.recordId,
                recordId: record.recordId,
                companyName: record.사업장명,
                industryName: record.업종명,
                industryCode: record.업종코드,
                establishedDate: record.성립일자,
                sido: record.시도,
                gugun: record.구군,
                employeeCount2024: record['2024'] || 0,
                preview: `2024년 ${record['2024'] || 0}명` // 간단한 미리보기
            }));

            context.res = {
                status: 200,
                headers: corsHeaders,
                body: {
                    success: true,
                    bizno: bizno,
                    multipleRecords: true, // 🔥 Frontend 호환성
                    count: duplicateCount, // 🔥 Frontend 호환성  
                    options: industryOptions, // 🔥 Frontend 호환성
                    mode: "industry-selection", // 기존 호환성 유지
                    duplicateCount: duplicateCount,
                    message: `${duplicateCount}개의 업종이 발견되었습니다. 분석할 업종을 선택해주세요.`,
                    industryOptions: industryOptions, // 기존 호환성 유지
                    queryInfo: {
                        table: 'insu_clean',
                        executionTime: `${executionTime}ms`,
                        timestamp: new Date().toISOString()
                    }
                }
            };
            return;
        }

        // 🎯 **특정 레코드 선택 또는 단일 레코드 처리**
        let companyData;
        if (recordId) {
            // recordId로 특정 레코드 선택
            companyData = result.recordset.find(record => record.recordId.toString() === recordId.toString());
            if (!companyData) {
                context.res = {
                    status: 404,
                    headers: corsHeaders,
                    body: {
                        success: false,
                        bizno: bizno,
                        recordId: recordId,
                        error: `사업자등록번호 ${bizno}의 recordId ${recordId}에 해당하는 데이터를 찾을 수 없습니다.`
                    }
                };
                return;
            }
            context.log(`🎯 특정 레코드 선택: recordId=${recordId}, 업종=${companyData.업종명}`);
        } else {
            // 단일 레코드인 경우 첫 번째 레코드 사용
            companyData = result.recordset[0];
            context.log(`📄 단일 레코드 처리: 업종=${companyData.업종명}`);
        }
        
        // 🚀 핵심: 세액공제 분석 실행 - 🎯 **연도별 파라미터 사용**
        const analysisResult = analyzeCompanyTaxCredit(companyData, yearlyParams);

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

        // 응답 구성 - 🎯 **TaxCreditDashboard 호환성 + 중복횟수 정보 추가**
        const responseData = {
            success: true,
            bizno: bizno,
            mode: "full-analysis",
            duplicateCount: duplicateCount, // 🔥 **중복횟수 정보 추가**
            selectedRecordId: recordId || companyData.recordId, // 🔥 **선택된 레코드 ID**
            queryInfo: {
                table: 'insu_clean',
                executionTime: `${executionTime}ms`,
                timestamp: new Date().toISOString()
            },
            companyInfo: {
                ...analysisResult.companyInfo,
                recordId: companyData.recordId, // 🔥 **레코드 ID 추가**
                duplicateCount: duplicateCount // 🔥 **중복횟수 추가**
            },
            employeeData: analysisResult.employeeData,
            analysisResults: analysisResult.results, // TaxCreditDashboard 호환성
            data: companyData, // 기존 호환성
            analysisResult: analysisResult, // 기존 호환성
            summary: analysisResult.summary,
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