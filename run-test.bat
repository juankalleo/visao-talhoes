@echo off
REM Inicia servidor e teste
cd /d "C:\Users\combo\Documents\projetos\visaoro-talhao"

REM Mata processos anteriores
taskkill /F /IM node.exe >nul 2>&1

REM Inicia servidor em background
start "Server" npx tsx server.ts

REM Aguarda um pouco
timeout /t 5 /nobreak

REM Executa teste
npx tsx test-debug.ts

REM Limpa
taskkill /F /IM node.exe >nul 2>&1
