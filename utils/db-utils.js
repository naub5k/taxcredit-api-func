const sql = require('mssql');

module.exports = async function executeQuery(query, params = [], context) {
  const connectStartTime = new Date();
  const maxRetries = 3; // 최대 재시도 횟수
  let retryCount = 0;
  let lastError = null;

  while (retryCount <= maxRetries) {
    try {
      // 개별 속성으로 연결 설정 구성
      const config = {
        server: process.env.DB_SERVER || 'naub5k.database.windows.net',
        user: process.env.DB_USER || 'naub5k',
        password: process.env.DB_PASS || 'dunkin3106UB!',
        database: process.env.DB_NAME || 'CleanDB',
        options: {
          encrypt: true,
          connectTimeout: 300000, // 300초 (5분) 타임아웃 설정
          requestTimeout: 300000 // 쿼리 실행 타임아웃 300초 (5분)
        }
      };
      
      if (context) {
        context.log(`DB 연결 시도 시작 (시도 ${retryCount + 1}/${maxRetries + 1}):`, config.server, config.database);
      }
      
      const pool = await sql.connect(config);
      const connectEndTime = new Date();
      
      if (context) context.log(`DB 연결 완료: ${connectEndTime - connectStartTime}ms 소요`);
      
      const queryStartTime = new Date();
      if (context) context.log('쿼리 실행 시도');
      
      const request = pool.request();
      
      // 매개변수 추가 - 타입 검증 및 재설정 로직 추가
      params.forEach(param => {
        // 문자열로 전달된 타입을 처리
        if (typeof param.type === 'string') {
          // 문자열 타입을 실제 SQL 타입으로 변환
          let sqlType;
          switch(param.type.toLowerCase()) {
            case 'nvarchar':
              sqlType = sql.NVarChar;
              break;
            case 'varchar':
              sqlType = sql.VarChar;
              break;
            case 'int':
              sqlType = sql.Int;
              break;
            default:
              sqlType = sql.NVarChar; // 기본값
          }
          
          if (context) context.log(`파라미터 '${param.name}'의 타입 '${param.type}'을 SQL 타입으로 변환하여 사용합니다.`);
          request.input(param.name, sqlType, param.value);
        }
        // 타입이 유효하지 않은 경우(parameter.type.validate is not a function 오류 방지)
        else if (!param.type || typeof param.type.validate !== 'function') {
          if (context) context.log.warn(`파라미터 '${param.name}'의 타입이 유효하지 않아 NVarChar로 재설정합니다.`);
          console.warn(`파라미터 '${param.name}'의 타입이 유효하지 않아 NVarChar로 재설정합니다.`);
          
          // sql 모듈에서 직접 NVarChar 타입 사용
          request.input(param.name, sql.NVarChar, param.value);
        } else {
          // 기존 타입이 유효한 경우 그대로 사용
          request.input(param.name, param.type, param.value);
        }
      });
      
      const result = await request.query(query);
      const queryEndTime = new Date();
      
      if (context) context.log(`쿼리 실행 완료: ${queryEndTime - queryStartTime}ms 소요, 레코드 수: ${result.recordset.length}`);
      
      await sql.close();
      return result;
    } catch (err) {
      lastError = err;
      const errorTime = new Date();
      
      if (context) {
        context.log.error(`DB 오류 발생 (시도 ${retryCount + 1}/${maxRetries + 1}): ${errorTime - connectStartTime}ms 경과 후`);
        context.log.error('오류 유형:', err.name);
        context.log.error('오류 메시지:', err.message);
        context.log.error('오류 스택:', err.stack);
      } else {
        console.error(`Database error (attempt ${retryCount + 1}/${maxRetries + 1}):`, err.message, err.stack);
      }
      
      // 콘솔 로깅 추가 - context 존재 여부와 관계없이 항상 출력
      console.error("콘솔 오류 (db-utils.js):", err.name, err.message, err.stack);
      
      try {
        await sql.close();
      } catch (closeErr) {
        if (context) context.log.error('연결 종료 중 추가 오류:', closeErr.message);
        console.error("연결 종료 중 추가 오류 (콘솔):", closeErr.message, closeErr.stack);
      }
      
      // 마지막 시도이면 오류 발생
      if (retryCount >= maxRetries) {
        if (context) context.log.error(`최대 재시도 횟수(${maxRetries})를 초과했습니다. 쿼리 실패.`);
        console.error(`최대 재시도 횟수(${maxRetries})를 초과했습니다. 쿼리 실패.`);
        throw err;
      }
      
      // 재시도 전 잠시 대기 (지수 백오프)
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // 최대 10초
      if (context) context.log.warn(`${waitTime}ms 후 재시도 (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      retryCount++;
    }
  }
  
  throw lastError;
}; 