# taxcredit-api-func

세액공제 분석용 Azure Functions API

## 📦 주요 기능

### `analyze` 함수
- **엔드포인트**: `/api/analyze?bizno={사업자등록번호}`
- **기능**: Azure SQL Database 연결 후 세액공제 분석 데이터 JSON 반환
- **응답 구조**:
  ```json
  {
    "success": true,
    "bizno": "1234567890",
    "data": {
      "사업자등록번호": "1234567890",
      "사업장명": "회사명",
      "시도": "지역",
      "2016": 0, "2017": 0, "2018": 0, "2019": 0, "2020": 0,
      "2021": 0, "2022": 0, "2023": 0, "2024": 0, "2025": 0,
      ...
    }
  }
  ```

### `getSampleList` 함수
- **엔드포인트**: `/api/getSampleList?sido={시도명}`
- **기능**: 지역별 사업장 샘플 데이터 조회

## 🚀 개발 및 배포

### 로컬 개발
```bash
# 의존성 설치
npm install

# 로컬 실행
npm start
# 또는
func start
```

### Azure 배포
```bash
# Azure Functions에 배포
npm run deploy
# 또는
npx func azure functionapp publish taxcredit-api-func
```

## 🔧 환경 설정

### local.settings.json (로컬 개발용)
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_SQL_CONNECTION_STRING": "Server=..."
  }
}
```

## 📁 프로젝트 구조

```
taxcredit-api-func/
├── analyze/
│   ├── index.js         # 세액공제 분석 함수
│   └── function.json    # 함수 설정
├── getSampleList/
│   ├── index.js         # 샘플 리스트 함수
│   └── function.json    # 함수 설정
├── utils/               # 공통 유틸리티
├── package.json
├── host.json
└── local.settings.json
```

## 🔗 연관 프로젝트

- **프론트엔드**: [taxcredit-analyze](https://github.com/naub5k/taxcredit-analyze)
- **배포 URL**: https://taxcredit-api-func.azurewebsites.net

## 📚 참고

- [Azure Functions Node.js 문서](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure SQL Database 연결](https://docs.microsoft.com/en-us/azure/azure-sql/) 