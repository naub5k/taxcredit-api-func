const sql = require('mssql');
const executeQuery = require('../utils/db-utils'); // 검증된 db-utils 사용
const aiAnalysis = require('../utils/ai-analysis'); // AI 분석 모듈 추가

module.exports = async function (context, req) {
    context.log('🤖 AI 분석 함수 시작 - insu_clean 전체 컬럼 조회 + 선택적 AI 분석');

    // CORS 헤더 설정
    const corsHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: {}
        };
        return;
    }

    try {
        // 1. 파라미터 추출
        const bizno = req.query.bizno || (req.body && req.body.bizno);
        const includeAI = req.query.includeAI === 'true' || (req.body && req.body.includeAI === true);
        const aiOnly = req.query.aiOnly === 'true' || (req.body && req.body.aiOnly === true);

        if (!bizno) {
            context.log.error('❌ bizno 파라미터 없음');
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Missing bizno parameter',
                    message: '사업자등록번호(bizno)가 필요합니다.',
                    usage: {
                        basicQuery: '?bizno=1234567890',
                        withAI: '?bizno=1234567890&includeAI=true',
                        aiOnly: '?bizno=1234567890&aiOnly=true'
                    }
                }
            };
            return;
        }

        context.log(`📝 요청된 bizno: ${bizno}`);
        context.log(`🤖 AI 분석 포함: ${includeAI ? 'YES' : 'NO'}`);
        context.log(`🎯 AI만 반환: ${aiOnly ? 'YES' : 'NO'}`);

        // 2. 🎯 핵심: SELECT * FROM insu_clean (모든 컬럼 조회)
        const query = `
            SELECT * FROM insu_clean 
            WHERE 사업자등록번호 = @bizno
        `;

        const params = [
            { name: 'bizno', type: sql.VarChar, value: bizno }
        ];

        context.log('🔍 실행할 쿼리:', query);

        // 3. DB 쿼리 실행
        const startTime = Date.now();
        const result = await executeQuery(query, params, context);
        const executionTime = Date.now() - startTime;

        context.log(`📊 DB 쿼리 완료 (${executionTime}ms)`);
        context.log(`📊 결과 건수: ${result.recordset ? result.recordset.length : 0}`);

        // 4. 데이터 존재 여부 확인
        if (!result.recordset || result.recordset.length === 0) {
            context.log.warn(`⚠️ bizno ${bizno}에 대한 데이터 없음`);
            context.res = {
                status: 404,
                headers: corsHeaders,
                body: {
                    success: false,
                    bizno: bizno,
                    error: `사업자등록번호 ${bizno}에 대한 데이터가 insu_clean 테이블에 없습니다.`,
                    queryInfo: {
                        table: 'insu_clean',
                        executionTime: `${executionTime}ms`,
                        timestamp: new Date().toISOString()
                    }
                }
            };
            return;
        }

        // 5. 🎯 핵심: 모든 컬럼을 그대로 반환 (컬럼명 변경 없음)
        const companyData = result.recordset[0];
        
        // 📋 컬럼 정보 로깅 (디버깅용)
        const columnNames = Object.keys(companyData);
        context.log(`📋 조회된 컬럼 목록 (총 ${columnNames.length}개):`, columnNames);
        
        // 연도별 컬럼 확인
        const yearColumns = columnNames.filter(col => col.match(/^\[?\d{4}\]?$/));
        context.log(`📅 연도별 컬럼 (${yearColumns.length}개):`, yearColumns);

        // 6. 🤖 AI 분석 실행 (요청에 따라)
        let aiAnalysisResult = null;
        if (includeAI || aiOnly) {
            context.log('🤖 AI 분석 실행 중...');
            const aiStartTime = Date.now();
            
            try {
                aiAnalysisResult = aiAnalysis.performComprehensiveAnalysis(companyData);
                const aiExecutionTime = Date.now() - aiStartTime;
                context.log(`🤖 AI 분석 완료 (${aiExecutionTime}ms)`);
            } catch (aiError) {
                context.log.error('🚨 AI 분석 오류:', aiError.message);
                aiAnalysisResult = {
                    error: 'AI 분석 중 오류가 발생했습니다: ' + aiError.message,
                    timestamp: new Date().toISOString()
                };
            }
        }

        // 7. 🎯 응답 구성 (요청 유형에 따라)
        let responseData;

        if (aiOnly) {
            // AI 분석 결과만 반환
            responseData = {
                success: true,
                bizno: bizno,
                mode: 'ai-only',
                queryInfo: {
                    table: 'insu_clean',
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString()
                },
                aiAnalysis: aiAnalysisResult
            };
        } else if (includeAI) {
            // 전체 데이터 + AI 분석 결과
            responseData = {
                success: true,
                bizno: bizno,
                mode: 'full-with-ai',
                queryInfo: {
                    table: 'insu_clean',
                    totalColumns: columnNames.length,
                    yearColumns: yearColumns,
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString()
                },
                // 🎯 핵심: insu_clean 테이블의 모든 컬럼을 원본 이름 그대로 반환
                data: companyData,
                // 🤖 AI 분석 결과 추가
                aiAnalysis: aiAnalysisResult
            };
        } else {
            // 기본: 순수 DB 데이터만 반환
            responseData = {
                success: true,
                bizno: bizno,
                mode: 'data-only',
                queryInfo: {
                    table: 'insu_clean',
                    totalColumns: columnNames.length,
                    yearColumns: yearColumns,
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString()
                },
                // 🎯 핵심: insu_clean 테이블의 모든 컬럼을 원본 이름 그대로 반환
                data: companyData
            };
        }

        context.log('✅ 응답 데이터 구성 완료');
        context.log('🔍 반환 모드:', responseData.mode);
        context.log('🔍 반환되는 주요 컬럼 샘플:', {
            사업자등록번호: companyData.사업자등록번호,
            사업장명: companyData.사업장명,
            시도: companyData.시도,
            구군: companyData.구군,
            제외여부: companyData.제외여부,
            연도컬럼수: yearColumns.length,
            AI분석포함: includeAI || aiOnly ? 'YES' : 'NO'
        });

        // 8. 성공 응답
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: responseData
        };

    } catch (error) {
        context.log.error('❌ analyze 함수 오류:', error.stack);
        
        const errorDetails = {
            name: error.name,
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        };
        
        context.log.error('🔍 상세 오류 정보:', errorDetails);
        
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                success: false,
                bizno: req.query.bizno || (req.body && req.body.bizno) || 'unknown',
                error: 'insu_clean 테이블 조회 중 오류가 발생했습니다: ' + error.message,
                errorDetails: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
}; 