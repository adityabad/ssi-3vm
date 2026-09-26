@echo off
title SSI 3-VM Stop All
echo Stopping all running Node & Vite services for SSI...
taskkill /F /IM node.exe
echo All SSI microservices stopped.
pause
