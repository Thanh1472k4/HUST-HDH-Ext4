# Môn học: Hệ Điều Hành (Operating Systems)
**Trường Đại học Bách Khoa Hà Nội (HUST)**

Repository phục vụ học tập môn Hệ điều hành và thực hiện **Bài tập lớn (Đề tài 16: Tìm hiểu hệ thống tệp ext2, ext3, ext4 trên Linux - Độ khó 5/5)**.

---

## 📁 Cấu trúc Thư mục

```text
HDH/
├── BTL/                        # Thư mục mã nguồn và tài liệu Bài tập lớn
│   ├── ext4_inspect.c          # Mã nguồn C phân tích Inode, Extent Tree & Block qua API Linux
│   ├── create_test_cases.sh    # Script tạo 4 kịch bản kiểm thử (Contiguous, Sparse, Prealloc, Fragmented)
│   ├── Makefile                # Tự động hóa build & test trên Linux
│   ├── README.md               # Báo cáo kỹ thuật và lý thuyết chuyên sâu về Ext4
│   ├── Noteofme.md             # Ghi chú định hướng và lưu ý của giảng viên
│   ├── HDH-v1-quanmake.docx    # Báo cáo đề tài hoàn chỉnh (bản Word)
│   └── web/                    # Giao diện Web mô phỏng trực quan luồng I/O & Block Extent
│       ├── index.html          # Giao diện Dashboard kỹ thuật
│       ├── css/styles.css      # Giao diện sạch sẽ (Clean Engineering Dashboard)
│       ├── js/                 # Bộ điều khiển mô phỏng (Pipeline, Terminal, Visualizer)
│       ├── run.py              # Server Web tích hợp (hỗ trợ cả Windows & Linux)
│       ├── run_demo.bat        # 1-Click chạy Web trên Windows
│       └── run_demo.sh         # 1-Click chạy Web trên Linux
├── Slide/                      # Slide bài giảng các chương học lý thuyết
├── Makefile                    # Makefile tại thư mục gốc (ủy quyền sang BTL)
├── run.py                      # Shortcut chạy Web visualizer ngay từ thư mục gốc
├── .gitignore                  # Bỏ qua cache Python, binary Linux và file tạm
└── README.md                   # Tài liệu hướng dẫn chung của Repository
```

---

## 🚀 Hướng Dẫn Chạy & Thử Nghiệm

Dự án được thiết kế để tương thích và chạy mượt mà trên cả **Windows** lẫn **Ubuntu / Linux**.

### 1. Trên Linux (Ubuntu / WSL2 / VMware)

#### A. Biên dịch và Chạy bộ kiểm thử C (Ext4 Inspector)
Yêu cầu đã cài đặt `gcc`, `make`, `e2fsprogs`:
```bash
# Cài đặt gói công cụ (nếu chưa có)
sudo apt update && sudo apt install -y build-essential e2fsprogs

# Chạy toàn bộ 4 kịch bản kiểm thử mẫu
make test

# Hoặc vào trực tiếp thư mục BTL
cd BTL
make test-all
```

#### B. Chạy Giao diện Web Mô phỏng (Web Visualizer)
```bash
# Cách 1: Chạy trực tiếp qua Python
python3 run.py

# Cách 2: Chạy qua shell script trong BTL/web
cd BTL/web
chmod +x run_demo.sh
./run_demo.sh
```
Trình duyệt sẽ tự động mở tại địa chỉ: `http://localhost:8000`.

---

### 2. Trên Windows

Giao diện Web mô phỏng có thể chạy trực tiếp trên Windows để xem trực quan các kịch bản kiểm thử và luồng xử lý:

```cmd
# Cách 1: Chạy script tự động (Click đúp chuột hoặc gõ cmd)
BTL\web\run_demo.bat

# Cách 2: Chạy qua Python
python run.py
```

---

## 👥 Thành viên Thực hiện
- **Sinh viên:** Lưu Thế Anh & Đỗ Minh Quân
- **Đại học:** Đại học Bách Khoa Hà Nội
- **Học kỳ:** 2026.1
