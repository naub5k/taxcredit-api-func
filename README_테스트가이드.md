# 🔄 api-func 테스트 가이드

**Azure Functions 백엔드 API** 전용 테스트 진입점 가이드

---

## 🎯 **API 목적**
> "여러 웹앱들이 모두 azure DB에 연결해서 데이터를 가져와야 하기 때문에, 실제 스키마에 따른 SQL 쿼리를 제대로 실행해서 값을 가져와서 계산식 함수 등에 적용할 수 있도록 하기 위함"

**핵심**: SQL 쿼리 실행 → 데이터 조회 → 세액공제 계산 → JSON 응답

---

## 🚀 **빠른 실행**

```bash
# 이 폴더에서 실행
func start
```
**API 서버 시작**: http://localhost:7071

---

## 📡 **API 엔드포인트 테스트**

### 1️⃣ **회사 데이터 조회**
```http
GET http://localhost:7071/api/getSampleList?bizno=1234567890
```

**응답 예시**:
```json
{
  "success": true,
  "bizno": "1234567890",
  "data": {
    "사업장명": "좋은느낌",
    "시도": "서울특별시",
    "구군": "강남구",
    "업종명": "소프트웨어 개발업",
    "제외여부": "N",
    "2020": 15,
    "2021": 15,
    "2022": 15,
    "2023": 18,
    "2024": 8
  }
}
```

### 2️⃣ **세액공제 분석 (핵심 API)**
```http
POST http://localhost:7071/api/analyze
Content-Type: application/json

{
  "bizno": "1234567890",
  "youthRatio": 0.0,
  "socialInsuranceRate": 1.0
}
```

**응답 구조**:
```json
{
  "success": true,
  "data": { /* 회사 기본 정보 */ },
  "analysisResult": {
    "results": [
      {
        "year": "2019",
        "increaseCount": 3,
        "employmentCredit": 21000000,
        "socialInsuranceCredit": 1500000,
        "totalCredit": 22500000,
        "status": "사후관리종료",
        "classification": {
          "icon": "💚",
          "title": "즉시신청"
        }
      }
    ],
    "summary": {
      "사후관리종료": 52500000,
      "사후관리진행중": 0,
      "기간경과미신청": 0,
      "총계": 52500000
    }
  }
}
```

---

## 🗄️ **DB 스키마 참조**

### **insu_clean 테이블 주요 컬럼**
- `사업자등록번호`: VARCHAR (Primary Key)
- `사업장명`: NVARCHAR
- `시도`, `구군`: NVARCHAR (지역 정보)
- `업종명`, `업종코드`: NVARCHAR (업종 분류)
- `제외여부`: CHAR(1) - **중요**: 법적 적용제외 기업 식별
- `[2016]` ~ `[2025]`: INT (연도별 인원수)

### **제외여부 컬럼 활용**
```sql
-- 법적 적용제외 기업 필터링
WHERE 제외여부 = 'N' OR 제외여부 IS NULL
```

---

## 🧮 **핵심 계산 로직**

### **고용증대세액공제 계산**
- **수도권**: 연 70만원 ~ 85만원 (연도별 차등)
- **수도권외**: 연 77만원 ~ 92만원
- **청년**: 추가 배수 적용 (1.29 ~ 1.57배)

### **사회보험료세액공제 계산**
- **일반업종**: 50% ~ 75%
- **신성장서비스업**: 75%
- **청년**: 2배 추가 적용

### **3단계 위험도 분류**
- 💚 **즉시신청**: 사후관리 종료, 추징 위험 없음
- ⚠️ **신중검토**: 사후관리 진행중, 추징 위험 있음
- ❌ **신청불가**: 경정청구 기간 만료
- 🚨 **추징대상**: 사후관리 위반으로 추징 발생

---

## 🧪 **테스트 시나리오**

### **시나리오 1: 기본 데이터 조회**
```bash
# 회사 데이터 존재 확인
curl "http://localhost:7071/api/getSampleList?bizno=1234567890"

# 결과: 200 OK + 회사 정보 JSON
```

### **시나리오 2: 세액공제 분석**
```bash
# Postman 또는 curl로 POST 요청
curl -X POST http://localhost:7071/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"bizno":"1234567890","youthRatio":0.0,"socialInsuranceRate":1.0}'

# 결과: 분석 결과 + 3단계 분류 JSON
```

### **시나리오 3: 실시간 파라미터 조정**
```bash
# 청년 비율 30% 적용
curl -X POST http://localhost:7071/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"bizno":"1234567890","youthRatio":0.3,"socialInsuranceRate":1.0}'

# 결과: 청년 가산 적용된 분석 결과
```

---

## 🔧 **개발자 디버깅**

### **로그 확인**
```bash
# Azure Functions 실행 시 콘솔에서 확인
func start --verbose
```

### **DB 연결 상태**
- **로컬**: appsettings.json 또는 local.settings.json
- **운영**: Azure Portal에서 연결 문자열 확인

### **CORS 설정**
모든 API에 CORS 헤더 자동 추가:
```javascript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
```

---

## 📊 **성능 모니터링**

### **응답 시간 측정**
```bash
# 시간 측정 포함 요청
time curl "http://localhost:7071/api/getSampleList?bizno=1234567890"
```

### **대용량 데이터 처리**
- DB 쿼리 최적화 완료
- 인덱스 활용으로 빠른 조회
- 메모리 효율적인 JSON 직렬화

---

## 🚨 **주요 에러 해결**

### **404 Error**
```json
{
  "success": false,
  "error": "사업자등록번호 1234567890에 대한 데이터가 없습니다."
}
```
→ DB에 해당 사업자번호 데이터 없음

### **500 Error**
- DB 연결 실패: 연결 문자열 확인
- SQL 쿼리 오류: 스키마 변경 확인
- 메모리 부족: Azure Functions 리소스 확인

---

## 📝 **배포 정보**

### **로컬 개발**
- URL: http://localhost:7071
- 설정: local.settings.json

### **운영 환경**
- URL: https://taxcredit-api-func.azurewebsites.net
- 배포: `func azure functionapp publish taxcredit-api-func`

---

## 🔗 **연관 문서**

- **전체 테스트 가이드**: [`../테스트진입점_통합_20250605.md`](../테스트진입점_통합_20250605.md)
- **프론트엔드 연동**: 
  - [`../taxcredit-analyze/README_테스트가이드.md`](../taxcredit-analyze/README_테스트가이드.md)
  - [`../taxcredit-visual/README_테스트가이드.md`](../taxcredit-visual/README_테스트가이드.md)

---

**DB 스키마 관련 질문이나 API 추가 개발이 필요하시면 언제든 말씀해주세요! 🚀** 