#!/usr/bin/env bash
# ==============================================================================
# Script khởi chạy EXT4 Visualizer Web Demo trên Ubuntu
# ==============================================================================

PORT=8080
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================================="
echo "    KHỞI CHẠY EXT4 KERNEL INTERNALS & DATA FLOW VISUALIZER"
echo "    Thư mục: $DIR"
echo "    Địa chỉ: http://localhost:$PORT"
echo "=================================================================="

# Kiểm tra xem port 8080 có đang bận không
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "[!] Cổng $PORT đang có tiến trình chạy. Thử mở cổng 8081..."
        PORT=8081
    fi
fi

# Tự động mở trình duyệt nếu có display
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    if command -v xdg-open >/dev/null 2>&1; then
        (sleep 1 && xdg-open "http://localhost:$PORT") &
    elif command -v google-chrome >/dev/null 2>&1; then
        (sleep 1 && google-chrome "http://localhost:$PORT") &
    elif command -v firefox >/dev/null 2>&1; then
        (sleep 1 && firefox "http://localhost:$PORT") &
    fi
fi

echo "[+] Khởi động HTTP server tại cổng $PORT..."
echo "[*] Nhấn Ctrl+C để dừng."
python3 -m http.server $PORT --directory "$DIR"
