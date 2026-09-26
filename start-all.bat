@echo off
title SSI 3-VM System Launcher
echo ===================================================
echo Starting SSI 3-VM Full Ecosystem...
echo ===================================================

echo [1/7] Starting DIDComm Mediator on Port 4000...
start "Mediator [Port 4000]" cmd /k "cd /d %~dp0didcomm-mediator && npm start"

ping 127.0.0.1 -n 2 >nul

echo [2/7] Starting Issuer Service on Port 3000...
start "Issuer Service [Port 3000]" cmd /k "cd /d %~dp0issuer-vm\issuer-service && npm start"

ping 127.0.0.1 -n 2 >nul

echo [3/7] Starting Holder Agent on Port 3001...
start "Holder Agent [Port 3001]" cmd /k "cd /d %~dp0holder-vm\holder-agent && npm start"

ping 127.0.0.1 -n 2 >nul

echo [4/7] Starting Verifier Agent on Port 8081...
start "Verifier Agent [Port 8081]" cmd /k "cd /d %~dp0verifier-vm\verifier-agent && npm start"

ping 127.0.0.1 -n 2 >nul

echo [5/7] Starting Issuer Dashboard UI on Port 5173...
start "Issuer Dashboard UI [Port 5173]" cmd /k "cd /d %~dp0issuer-vm\issuer-dashboard && npm run dev -- --port 5173"

ping 127.0.0.1 -n 2 >nul

echo [6/7] Starting Holder Wallet UI on Port 5174...
start "Holder Wallet UI [Port 5174]" cmd /k "cd /d %~dp0holder-vm\holder-wallet && npm run dev -- --port 5174"

ping 127.0.0.1 -n 2 >nul

echo [7/7] Starting Verifier Wallet UI on Port 5175...
start "Verifier Wallet UI [Port 5175]" cmd /k "cd /d %~dp0verifier-vm\verifier-wallet && npm run dev -- --port 5175"

echo ===================================================
echo All 7 SSI services launched in separate windows!
echo - Mediator:          http://localhost:4000
echo - Issuer Service:    http://localhost:3000
echo - Holder Agent:      http://localhost:3001
echo - Verifier Agent:    http://localhost:8081
echo - Issuer Dashboard:  http://localhost:5173
echo - Holder Wallet:     http://localhost:5174
echo - Verifier Wallet:   http://localhost:5175
echo ===================================================
