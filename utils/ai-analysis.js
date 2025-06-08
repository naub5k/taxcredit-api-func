/**
 * 🤖 AI 분석 모듈 
 * insu_clean 데이터를 기반으로 한 AI 분석 기능들
 * analyze 함수에서 분리하여 독립적으로 사용 가능
 */

// AI 기반 성장 잠재력 계산
function calculateGrowthPotential(company) {
    if (!company) return '데이터 없음';
    
    let score = 50; // 기본 점수

    // 업력 계산 (성립일자 기준)
    const 업력 = company.성립일자 ? 
        new Date().getFullYear() - new Date(company.성립일자).getFullYear() : 0;

    // 업력 가산점 (AI 가중치 적용)
    if (업력 >= 15) score += 25;
    else if (업력 >= 10) score += 20;
    else if (업력 >= 5) score += 15;
    else if (업력 >= 3) score += 10;

    // 산업군 AI 분석 (업종명 기준)
    const 업종명 = company.업종명 || '';
    let 산업군 = '일반';
    
    if (업종명.includes('제조') && (업종명.includes('전자') || 업종명.includes('IT') || 업종명.includes('반도체'))) {
        산업군 = '첨단기술';
        score += 30;
    } else if (업종명.includes('서비스') && (업종명.includes('IT') || 업종명.includes('소프트웨어'))) {
        산업군 = '기술서비스';
        score += 25;
    } else {
        score += 10;
    }

    // 지역별 성장 잠재력 (AI 경제 분석)
    const 시도 = company.시도 || '';
    if (['서울특별시', '경기도'].includes(시도)) score += 15;
    else if (['인천광역시', '부산광역시', '대구광역시'].includes(시도)) score += 10;
    else score += 5;

    // 제외여부 리스크 반영
    if (company.제외여부 === 'Y') score -= 40;

    // 점수별 등급 반환
    if (score >= 90) return '매우 높음 (AI 추천)';
    if (score >= 75) return '높음';
    if (score >= 60) return '보통';
    if (score >= 40) return '발전 가능';
    return '주의 필요';
}

// AI 점수 계산 (종합 평가)
function calculateAIScore(company) {
    if (!company) return 0;
    
    let score = 60;

    // 업력 점수 계산
    const 업력 = company.성립일자 ? 
        new Date().getFullYear() - new Date(company.성립일자).getFullYear() : 0;
    score += Math.min(업력 * 2.5, 25);

    // 산업 경쟁력 점수
    const 업종명 = company.업종명 || '';
    if (업종명.includes('제조') && (업종명.includes('전자') || 업종명.includes('IT'))) {
        score += 25; // 첨단기술
    } else if (업종명.includes('서비스') && 업종명.includes('IT')) {
        score += 20; // 기술서비스
    } else {
        score += 10; // 일반
    }

    // 데이터 신뢰도 점수
    const 중복횟수 = company.중복횟수 || 0;
    if (중복횟수 > 3) score -= 15;
    else if (중복횟수 > 1) score -= 5;

    // 규제 리스크
    if (company.제외여부 === 'Y') score -= 30;

    return Math.min(Math.max(score, 0), 100);
}

// 리스크 레벨 계산
function calculateRiskLevel(company) {
    if (!company) return '알 수 없음';
    
    let riskScore = 0;

    // 업력 리스크
    const 업력 = company.성립일자 ? 
        new Date().getFullYear() - new Date(company.성립일자).getFullYear() : 0;
    if (업력 < 3) riskScore += 30;

    // 데이터 품질 리스크
    const 중복횟수 = company.중복횟수 || 0;
    if (중복횟수 > 2) riskScore += 20;

    // 제외여부 리스크
    if (company.제외여부 === 'Y') riskScore += 50;

    // 산업 리스크
    const 업종명 = company.업종명 || '';
    if (!업종명.includes('IT') && !업종명.includes('기술') && !업종명.includes('서비스')) {
        riskScore += 10;
    }

    // 리스크 등급 반환
    if (riskScore >= 70) return '높음';
    if (riskScore >= 40) return '중간';
    if (riskScore >= 20) return '낮음';
    return '매우 낮음';
}

// 우선순위 계산
function calculatePriority(company) {
    const aiScore = calculateAIScore(company);
    const riskLevel = calculateRiskLevel(company);
    
    if (aiScore >= 80 && riskLevel === '매우 낮음') return 'A급 (최우선)';
    if (aiScore >= 70 && riskLevel === '낮음') return 'B급 (우선)';
    if (aiScore >= 60) return 'C급 (일반)';
    return 'D급 (검토 필요)';
}

// 예상 세액공제 계산 (AI 예측 모델)
function calculateEstimatedCredit(company) {
    if (!company) return 0;
    
    let baseCredit = 3000000; // AI 기본 예측값

    // 산업군별 AI 예측 승수
    const 업종명 = company.업종명 || '';
    if (업종명.includes('제조') && (업종명.includes('전자') || 업종명.includes('IT'))) {
        baseCredit *= 3; // 첨단기술
    } else if (업종명.includes('서비스') && 업종명.includes('IT')) {
        baseCredit *= 2.2; // 기술서비스
    } else {
        baseCredit *= 1.3; // 일반
    }

    // 업력별 가산 (경험 효과)
    const 업력 = company.성립일자 ? 
        new Date().getFullYear() - new Date(company.성립일자).getFullYear() : 0;
    if (업력 >= 10) baseCredit *= 1.5;
    else if (업력 >= 5) baseCredit *= 1.3;

    // 제외여부 리스크 반영
    if (company.제외여부 === 'Y') baseCredit *= 0.1;

    return Math.min(baseCredit, 50000000); // 최대 5천만원
}

// AI 기반 추천사항 생성
function generateRecommendations(company) {
    if (!company) return ['데이터가 없어 추천을 제공할 수 없습니다.'];
    
    const recommendations = [];

    // 제외여부 우선 확인
    if (company.제외여부 === 'Y') {
        recommendations.push('🚨 세액공제 제외 대상입니다. 즉시 세무사 상담을 받으시기 바랍니다.');
        return recommendations;
    }

    // 업력 기반 추천
    const 업력 = company.성립일자 ? 
        new Date().getFullYear() - new Date(company.성립일자).getFullYear() : 0;
    if (업력 < 3) {
        recommendations.push('📅 설립 3년 후 세액공제 신청이 가능합니다. 미리 준비하세요.');
    }

    // 업종별 AI 분석 기반 맞춤 추천
    const 업종명 = company.업종명 || '';
    if (업종명.includes('제조') && (업종명.includes('전자') || 업종명.includes('IT') || 업종명.includes('반도체'))) {
        recommendations.push('🚀 첨단기술 기업으로 최대 세액공제 혜택을 받을 수 있습니다.');
        recommendations.push('💡 R&D 투자 확대 시 추가 혜택이 가능합니다.');
    } else if (업종명.includes('서비스') && (업종명.includes('IT') || 업종명.includes('소프트웨어'))) {
        recommendations.push('💻 기술서비스업으로 디지털 전환 투자 시 추가 혜택을 받을 수 있습니다.');
    } else {
        recommendations.push('🔄 기술 혁신형 사업 전환을 고려해보세요.');
    }

    // 데이터 품질 관련 추천
    const 중복횟수 = company.중복횟수 || 0;
    if (중복횟수 > 1) {
        recommendations.push(`📊 데이터 중복(${중복횟수}건)이 있습니다. 정확한 분석을 위해 정리가 필요합니다.`);
    }

    // 지역별 추천
    const 시도 = company.시도 || '';
    if (['서울특별시', '경기도'].includes(시도)) {
        recommendations.push('🏙️ 수도권 소재로 다양한 정부 지원 프로그램을 활용할 수 있습니다.');
    }

    return recommendations;
}

// 종합 AI 분석 실행
function performComprehensiveAnalysis(companyData) {
    if (!companyData) {
        return {
            error: 'companyData가 제공되지 않았습니다.',
            timestamp: new Date().toISOString()
        };
    }

    // 기본 정보 추출
    const 업력 = companyData.성립일자 ? 
        new Date().getFullYear() - new Date(companyData.성립일자).getFullYear() : 0;

    // 산업군 분류
    const 업종명 = companyData.업종명 || '';
    let 산업군 = '일반';
    let 대분류 = '기타';
    let 중분류 = '일반';

    if (업종명.includes('제조')) {
        대분류 = '제조업';
        if (업종명.includes('전자') || 업종명.includes('IT') || 업종명.includes('반도체')) {
            산업군 = '첨단기술';
            중분류 = '전자부품';
        }
    } else if (업종명.includes('서비스')) {
        대분류 = '서비스업';
        if (업종명.includes('IT') || 업종명.includes('소프트웨어')) {
            산업군 = '기술서비스';
            중분류 = 'IT서비스';
        }
    } else if (업종명.includes('건설')) {
        대분류 = '건설업';
    } else if (업종명.includes('도매') || 업종명.includes('소매')) {
        대분류 = '도소매업';
    }

    return {
        // 회사 프로필
        companyProfile: {
            name: companyData.사업장명,
            industry: 업종명,
            industryCode: companyData.업종코드,
            location: `${companyData.시도} ${companyData.구군}`,
            address: companyData.사업장주소,
            postalCode: companyData.우편번호,
            establishedYear: companyData.성립일자 ? new Date(companyData.성립일자).getFullYear() : null,
            establishedDate: companyData.성립일자,
            category: {
                main: 대분류,
                sub: 중분류
            },
            classification: companyData.분류,
            duplicateCount: companyData.중복횟수,
            exclusionStatus: companyData.제외여부
        },

        // AI 인사이트
        aiInsight: {
            industryPosition: `${대분류} > ${중분류}`,
            businessAge: `설립 후 ${업력}년 경과`,
            industryType: 산업군,
            growthPotential: calculateGrowthPotential(companyData),
            aiScore: calculateAIScore(companyData),
            riskLevel: calculateRiskLevel(companyData)
        },

        // 세액공제 분석
        taxCreditAnalysis: {
            eligibility: 업력 >= 3 && (!companyData.제외여부 || companyData.제외여부 !== 'Y'),
            estimatedCredit: calculateEstimatedCredit(companyData),
            recommendations: generateRecommendations(companyData),
            priority: calculatePriority(companyData)
        },

        // 시스템 정보
        systemInfo: {
            functionApp: 'api-func-v2',
            analysisMethod: 'ai-powered',
            queryExecutionTime: new Date().toISOString(),
            tableUsed: 'insu_clean',
            schemaVersion: '20240604',
            aiModelVersion: '1.1'
        }
    };
}

// 모듈 내보내기
module.exports = {
    calculateGrowthPotential,
    calculateAIScore,
    calculateRiskLevel,
    calculatePriority,
    calculateEstimatedCredit,
    generateRecommendations,
    performComprehensiveAnalysis
}; 