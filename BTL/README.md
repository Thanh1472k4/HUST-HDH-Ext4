# BÁO CÁO KỸ THUẬT & HƯỚNG DẪN THỰC NGHIỆM ĐỀ TÀI 16
## TÌM HIỂU EXT3/EXT4 TRÊN LINUX VÀ TRÍCH XUẤT INODE/EXTENT BẰNG SYSTEM API

- **Môn học**: Hệ điều hành (BTL Đề tài 16 - Độ khó 5/5)
- **Sinh viên**: Lưu Thế Anh & Đỗ Minh Quân
- **Cơ sở đào tạo**: Đại học Bách Khoa Hà Nội

---

## 1. Cơ sở lý thuyết cốt lõi (Phục vụ báo cáo & Phản biện Vấn đáp)

### 1.1. Cấu trúc Inode trong Linux
Inode (Index Node) là cấu trúc dữ liệu trên đĩa đại diện cho một đối tượng file hệ thống (không chứa tên file hay nội dung file).
- **Ext3**: Inode mặc định có kích thước 128 bytes.
- **Ext4**: Inode mặc định có kích thước 256 bytes (hoặc lớn hơn), cho phép lưu thêm:
  - Timestamp độ phân giải **nanosecond** (thay vì 1 giây như ext3).
  - Mốc thời gian tạo file: **Creation/Birth Time (btime / crtime)** (ext3 hoàn toàn không có).
  - Vùng mở rộng inode (`extra_isize`) hỗ trợ Extended Attributes (xattr).

### 1.2. So sánh Cốt lõi: Quản lý khối đĩa Ext3 vs Ext4

| Tiêu chí | Ext3 (Indirect Block Pointers) | Ext4 (Extent Tree Structure) |
| :--- | :--- | :--- |
| **Cơ chế lưu trữ** | 15 con trỏ trong Inode (`i_block[15]`):<br>• 12 con trỏ trực tiếp (Direct)<br>• 1 con trỏ gián tiếp cấp 1 (Indirect)<br>• 1 con trỏ gián tiếp cấp 2 (Double Indirect)<br>• 1 con trỏ gián tiếp cấp 3 (Triple Indirect) | **Cây Extent (Extent Tree - H-Tree / B-Tree biến thể)**.<br>Mỗi Extent đại diện cho một dải khối liên tục: `[Logical Block, Physical Block, Length]`. |
| **Kích thước file tối đa** | Giới hạn 2 TiB (với block size 4 KiB, đánh số 32-bit). | Lên tới 16 TiB (hoặc 1 EiB với 64-bit feature). |
| **Địa chỉ hóa khối vật lý** | 32-bit Block Numbers. | **48-bit Block Numbers** (khả năng đánh địa chỉ cực lớn). |
| **Chi phí Metadata** | File 100 MB liên tục cần hàng chục ngàn con trỏ 4-byte riêng lẻ trong các Indirect blocks $\rightarrow$ Tốn I/O đĩa. | File 100 MB liên tục chỉ cần **1 Extent duy nhất** (12 bytes) $\rightarrow$ Giảm metadata tới 99%. |
| **Độ dài Extent tối đa** | Không có khái niệm extent. | 1 Extent chuẩn có thể dài tới $2^{15} = 32,768$ blocks (128 MiB với block 4KB). |
| **Cấp phát trước (Preallocation)** | Không hỗ trợ hiệu quả (phải ghi đè 0 ra đĩa). | Hỗ trợ cờ `UNWRITTEN` (qua `fallocate`) $\rightarrow$ Khối được đánh dấu cấp phát nhưng chưa ghi, không sợ rò rỉ dữ liệu cũ. |

### 1.3. Cấu trúc chi tiết của Cây Extent trong Ext4
Trong ext4, mảng 60-byte (`i_data` hay `i_block[15]` của inode cũ) được chuyển thành cấu trúc Extent Root:
1. **`ext4_extent_header`** (12 bytes):
   - `eh_magic`: `0xF30A` (Magic xác nhận đây là cây extent)
   - `eh_entries`: Số lượng phần tử hiện tại
   - `eh_max`: Số phần tử tối đa chứa được
   - `eh_depth`: Độ sâu của cây ($0$ = Node lá chứa dữ liệu trực tiếp, $>0$ = Node chỉ mục nội bộ)
2. **`ext4_extent` (Node lá - Leaf)** (12 bytes):
   - `ee_block` (32-bit): Khối logic bắt đầu trong file
   - `ee_len` (16-bit): Số lượng khối trong dải (nếu $\le 32768$ là khối đã ghi; nếu $> 32768$ là khối `UNWRITTEN`)
   - `ee_start_hi` (16-bit) + `ee_start_lo` (32-bit): Ghép thành **48-bit Physical Block Number** trên đĩa.
3. **`ext4_extent_idx` (Node chỉ mục - Index)** (12 bytes):
   - Dùng khi file lớn vượt quá 4 extents ở Root, trỏ tới block khác chứa các nhánh lá tiếp theo.

### 1.4. Cơ chế hoạt động của System API: `statx()` & `FS_IOC_FIEMAP`
- **`statx()`**: Được Linux Kernel bổ sung từ phiên bản 4.11 (`<sys/stat.h>`), thay thế `stat()` truyền thống. Hỗ trợ trường `stx_btime` (Birth time), `stx_attributes` và cho phép chọn mặt nạ truy vấn `STATX_ALL` với độ trễ tối ưu.
- **`FS_IOC_FIEMAP`**: Là ioctl chuẩn của Linux VFS (Virtual Filesystem) định nghĩa trong `<linux/fiemap.h>`.
  - Kernel gọi hàm callback `fiemap` của ext4 driver (`ext4_fiemap`).
  - Ext4 duyệt cây Extent tương ứng của Inode và copy cấu trúc `struct fiemap_extent` ra user-space buffer.
  - Cờ `FIEMAP_FLAG_SYNC` ép hệ thống xả cache (flush dirty pages) xuống đĩa trước khi trích xuất, đảm bảo ánh xạ là khối vật lý thực sự.

---

## 2. Các Kịch Bản Kiểm Thử (Test Suite)

| Tên Test Case | Kịch bản thực tế | Hiện tượng quan sát trên Extent Inspector |
| :--- | :--- | :--- |
| **Case 1: Contiguous** | Ghi file 1MB tuần tự | **1 Extent duy nhất** dài 256 blocks, 0% phân mảnh. |
| **Case 2: Sparse File** | Nhảy cách quãng (seek) ghi vài KB ở các offset xa | Dung lượng logic ~10MB nhưng dung lượng đĩa thực tế chỉ 12KB (3 blocks). Các khoảng trống giữa các extent là **Lỗ hổng (Hole)**. |
| **Case 3: Preallocation** | Dùng `fallocate` cấp trước 2MB | Cờ **`UNWRITTEN`** xuất hiện. Khối đã được đặt chỗ trước nhưng chưa ghi dữ liệu. |
| **Case 4: Fragmented** | Ghi xen kẽ ngắt quãng giữa 2 file | Bị đứt gãy thành **12 Extents**, tỷ lệ đứt gãy đĩa > 90%. |

---

## 3. Cách Biên Dịch & Chạy Thử Nghiệm

```bash
# 1. Biên dịch
make clean && make

# 2. Khởi tạo 4 test cases mẫu trên phân vùng ext4
./create_test_cases.sh

# 3. Chạy phân tích từng trường hợp
./ext4_inspect /home/thanh/ext4_test_suite/case1_contiguous.dat
./ext4_inspect /home/thanh/ext4_test_suite/case2_sparse.dat
./ext4_inspect /home/thanh/ext4_test_suite/case3_preallocated.dat
./ext4_inspect /home/thanh/ext4_test_suite/case4_fragmented.dat

# 4. Đối chứng trực tiếp với công cụ của hệ thống Linux
filefrag -v -b4096 /home/thanh/ext4_test_suite/case1_contiguous.dat
```
