#!/usr/bin/env bash
# ==============================================================================
# Script tự động tạo 4 kịch bản kiểm thử (Test Cases) trên phân vùng ext4
# Thư mục kiểm thử: /home/thanh/ext4_test_suite
# ==============================================================================

TEST_DIR="/home/thanh/ext4_test_suite"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR" || exit 1

echo "=================================================================="
echo "    KHỞI TẠO TẬP HỢP TEST CASES CHO BTL EXT4 INSPECTOR"
echo "    Thư mục lưu trữ: $TEST_DIR (Nằm trên phân vùng ext4)"
echo "=================================================================="

# Test Case 1: File chuẩn liên tục (1 Extent lớn)
echo "[+] 1. Đang tạo Test Case 1: File chuẩn liên tục 1MB..."
dd if=/dev/urandom of=case1_contiguous.dat bs=64K count=16 status=none
sync case1_contiguous.dat

# Test Case 2: Sparse File (File có lỗ hổng - Hole)
echo "[+] 2. Đang tạo Test Case 2: Sparse File (Kích thước logic 10MB nhưng chỉ tốn vài KB đĩa)..."
rm -f case2_sparse.dat
# Ghi 4KB ở đầu file (offset 0)
dd if=/dev/urandom of=case2_sparse.dat bs=4K count=1 seek=0 conv=notrunc status=none
# Nhảy cách 1000 blocks (khoảng 4MB) và ghi tiếp 4KB
dd if=/dev/urandom of=case2_sparse.dat bs=4K count=1 seek=1000 conv=notrunc status=none
# Nhảy tiếp đến block 2500 (khoảng 10MB) và ghi 4KB
dd if=/dev/urandom of=case2_sparse.dat bs=4K count=1 seek=2500 conv=notrunc status=none
sync case2_sparse.dat

# Test Case 3: File cấp phát trước không ghi (fallocate - Preallocated Unwritten)
echo "[+] 3. Đang tạo Test Case 3: Preallocated File (fallocate - Cờ UNWRITTEN)..."
rm -f case3_preallocated.dat
fallocate -l 2M case3_preallocated.dat
sync case3_preallocated.dat

# Test Case 4: File phân mảnh (Fragmented File - Nhiều Extents không liên tục)
echo "[+] 4. Đang tạo Test Case 4: File phân mảnh (Fragmented - Ép đứt gãy Extents)..."
rm -f case4_fragmented.dat dummy_interleave.dat
for i in $(seq 1 12); do
    dd if=/dev/urandom of=case4_fragmented.dat bs=64K count=1 seek=$((i * 2)) conv=notrunc status=none
    dd if=/dev/urandom of=dummy_interleave.dat bs=128K count=1 seek=$i conv=notrunc status=none
    sync
done
sync case4_fragmented.dat

echo "=================================================================="
echo "  HOÀN TẤT KHỞI TẠO TẤT CẢ 4 TEST CASES!"
echo "  Các file đã sẵn sàng tại: $TEST_DIR"
echo "=================================================================="
ls -lh "$TEST_DIR"
