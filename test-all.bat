@echo off
REM Inicia servidor e testa todos os endpoints
cd /d "C:\Users\combo\Documents\projetos\visaoro-talhao"

REM Mata processos anteriores
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak

REM Inicia servidor em background
start "Server" npx tsx server.ts

REM Aguarda servidor iniciar
timeout /t 6 /nobreak

REM Executa testes
npx tsx test-all-endpoints.ts

REM Limpa
taskkill /F /IM node.exe >nul 2>&1
