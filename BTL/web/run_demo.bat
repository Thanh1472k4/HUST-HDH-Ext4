@echo off
chcp 65001 >nul
title EXT4 Visualizer Web Demo
cd /d "%~dp0"

echo ==================================================================
echo     KHOI CHAY EXT4 VISUALIZER WEB DEMO (WINDOWS LAUNCHER)
echo ==================================================================
echo.

:: Mo trinh duyet web sau 1 giay
start "" "http://localhost:8080/index.html"

echo [*] Dang khoi dong HTTP Server tai cong 8080...
echo [*] Nhan Ctrl + C de dung server khi ket thuc.
echo.

:: Chay server python
python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    py -m http.server 8080
    if %ERRORLEVEL% NEQ 0 (
        echo [!] Khong tim thay Python. Dang mo truc tiep index.html...
        start "" "index.html"
    )
)

pause
