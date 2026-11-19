@echo off
chcp 65001 >nul
title EXT4 Kernel Internals & Data Flow Visualizer
cd /d "%~dp0"

echo ==================================================================
echo     KHỞI CHẠY EXT4 VISUALIZER WEB DEMO (WINDOWS LAUNCHER)
echo ==================================================================
echo.

:: Mở trình duyệt web sau 1 giây
start "" http://localhost:8080/index.html

echo [*] Đang khởi động HTTP Server nội bộ tại cổng 8080...
echo [*] Nếu máy chưa cài Python, trình duyệt vẫn có thể mở file trực tiếp.
echo [*] Nhấn Ctrl + C để tắt server khi kết thúc.
echo.

:: Kiểm tra và khởi động python server nếu có
python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    py -m http.server 8080
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [!] Không tìm thấy Python trong hệ thống Windows.
        echo [*] Đang mở trực tiếp file index.html bằng trình duyệt mặc định...
        start "" "index.html"
    )
)

pause
