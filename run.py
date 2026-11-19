#!/usr/bin/env python3
# ==============================================================================
# RUN.PY - 1-CLICK LAUNCHER CHO VS CODE & UBUNTU
# Có tích hợp endpoint /shutdown để tự động tắt sạch khi người dùng yêu cầu
# ==============================================================================

import os
import sys
import webbrowser
import http.server
import socketserver
import threading
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(CURRENT_DIR, "index.html")):
    WEB_DIR = CURRENT_DIR
elif os.path.exists(os.path.join(CURRENT_DIR, "BTL", "web", "index.html")):
    WEB_DIR = os.path.join(CURRENT_DIR, "BTL", "web")
else:
    WEB_DIR = "/home/thanh/Desktop/HDH/BTL/web"

def find_available_port(start_port=8080):
    import socket
    port = start_port
    while port < start_port + 20:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
        port += 1
    return start_port

PORT = find_available_port(8080)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        # Lắng nghe lệnh tắt server từ giao diện web
        if self.path == '/shutdown':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status":"stopped"}')
            print("\n[+] Đã nhận tín hiệu tắt từ Web. Đang tắt tiến trình Python và giải phóng cổng...")
            
            def terminate_process():
                time.sleep(0.5)
                os._exit(0)

            threading.Thread(target=terminate_process, daemon=True).start()
            return

        super().do_GET()

def launch_browser():
    time.sleep(0.8)
    url = f"http://localhost:{PORT}/index.html"
    print(f"\n[+] Đang tự động mở trình duyệt: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"[!] Không thể mở trình duyệt tự động ({e}), vui lòng mở thủ công.")

if __name__ == "__main__":
    print("=" * 66)
    print("       KHỞI CHẠY EXT4 KERNEL INTERNALS & DATA FLOW VISUALIZER")
    print(f"       Thư mục Web : {WEB_DIR}")
    print(f"       Địa chỉ     : http://localhost:{PORT}")
    print("=" * 66)

    # Chạy luồng mở browser song song
    threading.Thread(target=launch_browser, daemon=True).start()

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
            print(f"[*] Server HTTP đã sẵn sàng tại http://localhost:{PORT}")
            print("[*] Khi xong việc, bạn có thể bấm nút [⏹ Tắt Server] trên web hoặc bấm Ctrl+C tại đây.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Đã dừng Server an toàn. Tạm biệt!")
        sys.exit(0)
