const executeQuery = require('./utils/db-utils');

async function testSchema() {
  try {
    console.log('🔍 DB 스키마 확인 시작...');
    
    // 1. 테이블의 컬럼 정보 확인
    const schemaQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'insu_clean'
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log('📋 컬럼 정보 조회 중...');
    const schemaResult = await executeQuery(schemaQuery);
    
    console.log('📊 insu_clean 테이블 컬럼 목록:');
    schemaResult.recordset.forEach((col, index) => {
      console.log(`  ${index + 1}. ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // 2. 사업자등록번호 관련 컬럼 찾기
    const biznoColumns = schemaResult.recordset.filter(col => 
      col.COLUMN_NAME.toLowerCase().includes('biz') ||
      col.COLUMN_NAME.toLowerCase().includes('business') ||
      col.COLUMN_NAME.includes('사업자') ||
      col.COLUMN_NAME.toLowerCase().includes('reg')
    );
    
    console.log('\n🎯 사업자등록번호 관련 컬럼들:');
    biznoColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}`);
    });
    
    // 3. 샘플 데이터 조회 (상위 3개 레코드)
    console.log('\n📄 샘플 데이터 조회 중...');
    const sampleQuery = `SELECT TOP 3 * FROM insu_clean`;
    const sampleResult = await executeQuery(sampleQuery);
    
    if (sampleResult.recordset.length > 0) {
      console.log('\n📋 샘플 데이터:');
      console.log('컬럼 수:', Object.keys(sampleResult.recordset[0]).length);
      console.log('첫 번째 레코드 컬럼들:', Object.keys(sampleResult.recordset[0]));
      
      // 사업자등록번호로 보이는 값들 찾기
      const firstRecord = sampleResult.recordset[0];
      Object.keys(firstRecord).forEach(key => {
        const value = firstRecord[key];
        if (typeof value === 'string' && /^\d{10}$/.test(value)) {
          console.log(`  🎯 사업자등록번호로 추정: ${key} = ${value}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 스키마 확인 오류:', error.message);
  }
}

testSchema(); 