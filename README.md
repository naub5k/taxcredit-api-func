# taxcredit-api-func

세액공제 대상 기업 자동 분석을 위한 Azure Function API

## 📌 주요 함수 (Functions)

### 🔍 `analyze`
- **설명**: 사업자등록번호(`bizno`)를 받아 해당 기업의 고용 증가율, 요건 충족 여부, 공제 가능성 등을 계산하여 반환
- **메서드**: `POST`
- **경로**: `/api/analyze`
- **요청 형식**:
  ```json
  {
    "bizno": "1234567890"
  }
  ```
- **응답 예시**:
  ```json
  {
    "success": true,
    "bizno": "1234567890",
    "result": {
      "고용유지충족": true,
      "공제가능성": "있음",
      "전년대비증가": 3
    }
  }
  ```

### 🧪 `getSampleList`
- **설명**: 샘플 데이터 리스트 확인용
- **메서드**: `GET`
- **경로**: `/api/getSampleList`

---

## 🛠 배포 방법

```bash
npx func azure functionapp publish taxcredit-api-func
```

- **Azure Function App 이름**: `taxcredit-api-func`
- `local.settings.json`은 Git에 포함되지 않음 (`.gitignore` 설정 포함)

---

## 🗂 프로젝트 구조

```
api-func/
├── analyze/
│   ├── function.json
│   └── index.js
├── getSampleList/
│   ├── function.json
│   └── index.js
├── utils/
│   └── ...
├── host.json
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ 환경 설정

- Node.js 18+
- Azure Functions Core Tools
