@echo off
echo 🚀 Azure Functions 배포 시작...
cd /d "D:\Projects\taxcredit_mobileapp\api-func"
echo 📁 현재 디렉토리: %CD%
echo 📋 host.json 확인...
dir host.json
echo 🌐 Azure Functions 배포 실행...
npx func azure functionapp publish taxcredit-api-func
echo ✅ 배포 완료!
pause 