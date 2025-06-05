# 🚀 GitHub Actions 자동 배포 가이드

## 📋 **현재 상태 요약**

### 🔍 **Git 상태**
- **Repository**: `https://github.com/naub5k/taxcredit-api-func`
- **Branch**: `main`
- **미커밋 파일들**:
  - `README.md` (수정됨)
  - `analyze/index.js` (수정됨)
  - `getSampleList/index.js` (수정됨)
  - `README_테스트가이드.md` (신규)
  - `.github/workflows/deploy-azure-functions.yml` (신규)

### 🎯 **GitHub Actions 구성 완료**
- ✅ `.github/workflows/` 디렉토리 생성
- ✅ `deploy-azure-functions.yml` 워크플로우 파일 생성
- ✅ 자동 배포 파이프라인 구성

---

## 🛠️ **1단계: Azure 발행 프로필 설정**

### 🔐 **Publish Profile 다운로드**
```bash
# Azure CLI로 발행 프로필 다운로드
az functionapp deployment list-publishing-profiles --name taxcredit-api-func --resource-group [리소스그룹명] --xml
```

### 🔑 **GitHub Secrets 설정**
1. GitHub Repository → Settings → Secrets and variables → Actions
2. `New repository secret` 클릭
3. **Name**: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
4. **Secret**: Azure에서 다운로드한 XML 내용 전체 복사/붙여넣기

---

## 🚀 **2단계: 변경사항 커밋 및 푸시**

### 📝 **현재 변경사항 커밋**
```bash
# 모든 변경사항 스테이징
git add .

# 커밋 메시지와 함께 커밋
git commit -m "feat: GitHub Actions 자동 배포 환경 구성

- .github/workflows/deploy-azure-functions.yml 추가
- Azure Functions 자동 배포 파이프라인 구성
- API 함수들 최적화 및 테스트 가이드 추가
- README 업데이트"

# GitHub에 푸시
git push origin main
```

### 🔄 **자동 배포 트리거**
- `main` 브랜치에 푸시하면 **자동으로** GitHub Actions 실행
- **Pull Request** 생성 시에도 빌드 테스트 실행

---

## 📊 **3단계: 배포 모니터링**

### 👀 **GitHub Actions 확인**
1. GitHub Repository → Actions 탭
2. 워크플로우 실행 상태 확인
3. 실패 시 로그 확인 가능

### 🌐 **배포 확인 방법**
```bash
# Azure Functions 상태 확인
curl https://taxcredit-api-func.azurewebsites.net/api/getSampleList

# 상세 분석 API 테스트
curl -X POST https://taxcredit-api-func.azurewebsites.net/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"company_name": "테스트회사"}'
```

---

## ⚙️ **워크플로우 구성 상세**

### 🎯 **트리거 조건**
- `main` 브랜치 푸시
- `main` 브랜치 대상 PR

### 🔧 **배포 단계**
1. **📥 코드 체크아웃**
2. **🟢 Node.js 18.x 설정**
3. **📦 의존성 설치** (`npm ci`)
4. **🧹 빌드** (있는 경우)
5. **🧪 테스트** (있는 경우)
6. **🚀 Azure Functions 배포**

### 🌟 **주요 특징**
- 한국어 로그 출력
- 성공/실패 알림
- 환경별 배포 (production environment)
- 캐싱을 통한 빌드 속도 최적화

---

## 🔧 **추가 설정 옵션**

### 🎛️ **환경별 배포**
```yaml
# staging 환경 추가하려면
- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  uses: Azure/functions-action@v1
  with:
    app-name: 'taxcredit-api-func-staging'
```

### 📱 **Slack/Teams 알림 추가**
```yaml
- name: Slack Notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🚨 **문제 해결**

### ❌ **일반적인 문제들**
1. **Publish Profile 오류**: Azure Portal에서 새로 다운로드
2. **의존성 오류**: `package-lock.json` 확인
3. **권한 오류**: Azure 구독 권한 확인

### 🔍 **디버깅 방법**
```bash
# 로컬에서 Azure Functions 테스트
func start

# Azure CLI로 배포 로그 확인
az functionapp log tail --name taxcredit-api-func --resource-group [리소스그룹명]
```

---

## ✅ **다음 단계**

1. **🔐 Azure Publish Profile 설정**
2. **📤 git add, commit, push 실행**
3. **👀 GitHub Actions 실행 확인**
4. **🧪 배포된 API 테스트**
5. **🔄 지속적 개발/배포 사이클 구축**

---

**📞 문의사항이 있으시면 언제든 말씀해 주세요!** 🚀 