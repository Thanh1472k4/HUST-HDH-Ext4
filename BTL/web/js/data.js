/**
 * DATA.JS - Dữ liệu thực nghiệm trích xuất từ đĩa EXT4 trên máy Ubuntu
 * Đồ án Môn học Hệ Điều Hành - Đề tài 16 (Bách Khoa Hà Nội)
 */

const TEST_CASES_DATA = {
  case1: {
    id: "case1",
    name: "Case 1: Contiguous File (Tệp tuần tự liên tục 1MB)",
    path: "/home/thanh/ext4_test_suite/case1_contiguous.dat",
    command: "./ext4_inspect /home/thanh/ext4_test_suite/case1_contiguous.dat",
    badge: "100% Liên tục",
    badgeColor: "success",
    description: "File 1MB được ghi tuần tự bằng lệnh dd. Toàn bộ dữ liệu nằm trên một dải khối vật lý liên tục duy nhất, độ sâu cây extent = 0.",
    filesystem: {
      magic: "0xEF53",
      type: "EXT4 (Chuẩn hỗ trợ Extent Tree)",
      blockSize: 4096,
      totalBlocks: 5115796,
      freeBlocks: 1328786,
      totalInodes: 1310720,
      freeInodes: 1125066
    },
    metadata: {
      inode: 1053889,
      mode: "-rw-rw-r--",
      modeOctal: "0664",
      owner: "thanh (1000) / thanh (1000)",
      links: 1,
      sizeBytes: 1048576,
      sizeHuman: "1.00 MiB",
      sectors512: 2048,
      diskSizeHuman: "1024 KiB",
      optimalIoSize: 4096,
      timestamps: {
        btime: "2026-11-12 15:37:06.899322513",
        atime: "2026-11-12 15:37:06.899322513",
        mtime: "2026-11-12 15:47:05.746091414",
        ctime: "2026-11-12 15:47:05.746091414"
      }
    },
    extentTree: {
      header: {
        magic: "0xF30A",
        entries: 1,
        maxEntries: 4,
        depth: 0,
        generation: 0
      },
      extents: [
        {
          index: 0,
          logicalStart: 0,
          logicalEnd: 255,
          physicalStart: 4433152,
          physicalEnd: 4433407,
          lengthBlocks: 256,
          lengthBytes: 1048576,
          flags: ["LAST"],
          status: "WRITTEN",
          isLast: true
        }
      ]
    },
    evaluation: {
      totalBlocks: 256,
      gaps: 0,
      fragRate: "0.0%",
      status: "HOÀN HẢO (100% liên tục trên đĩa)"
    },
    ext3Comparison: {
      mechanism: "15 con trỏ i_block[15]",
      directBlocks: 12,
      indirectBlocks1: 244,
      indirectBlocks2: 0,
      indirectBlocks3: 0,
      metadataBlocksNeeded: 1,
      metadataBytes: 4096,
      ext4MetadataBytes: 12,
      savedPercent: "99.7%",
      explanation: "Ext3 cần dùng 12 con trỏ trực tiếp + 1 con trỏ gián tiếp cấp 1 dẫn tới 1 block gián tiếp phụ (tốn 4KB metadata). Ext4 chỉ cần duy nhất 1 extent 12 bytes nằm gọn ngay trong Inode!"
    },
    pipelineSteps: [
      {
        step: 1,
        title: "1. Khởi tạo & Đóng gói tại User Space",
        sub: "Chuẩn bị tham số và cấp phát cấu trúc dữ liệu",
        detail: "Chương trình ext4_inspect mở file qua open(path, O_RDONLY | O_LARGEFILE). Cấp phát struct statx stx và struct fiemap fm trên Stack.",
        structCode: `// User-Space: Cấu trúc fiemap yêu cầu thăm dò (Probe Phase)
struct fiemap fm = {
    .fm_start = 0,
    .fm_length = FIEMAP_MAX_OFFSET,
    .fm_flags = FIEMAP_FLAG_SYNC, // Ép xả dirty cache xuống đĩa
    .fm_extent_count = 0          // 0 để hỏi Kernel số lượng extents
};`
      },
      {
        step: 2,
        title: "2. Chuyển tiếp Ring 3 -> Ring 0 (Syscall Boundary)",
        sub: "Thực hiện system call statx() và ioctl()",
        detail: "CPU chuyển từ chế độ User mode sang Kernel mode qua lệnh gọi ngắt/syscall. VFS định vị tệp qua dentry cache và gắn với Inode 1053889.",
        structCode: `// Chuyển giao điều khiển cho nhân Linux
statx(AT_FDCWD, path, AT_SYMLINK_NOFOLLOW, STATX_ALL, &stx);
ioctl(fd, FS_IOC_FIEMAP, &fm);`
      },
      {
        step: 3,
        title: "3. Ext4 Driver & Duyệt Cây Extent",
        sub: "Xử lý tại hàm ext4_fiemap() trong Kernel",
        detail: "Ext4 kiểm tra cờ FIEMAP_FLAG_SYNC -> xả các trang dirty. Kernel đọc cấu trúc 60-byte i_data của Inode: eh_magic = 0xF30A, eh_depth = 0. Nhánh lá chứa ngay dải 256 blocks.",
        structCode: `// Kernel Subsystem: ext4_extent_header tại offset i_data
struct ext4_extent_header {
    __le16 eh_magic = 0xF30A; // Xác thực cây Extent
    __le16 eh_entries = 1;     // Có 1 extent duy nhất
    __le16 eh_max = 4;         // Sức chứa Inode root: 4 entries
    __le16 eh_depth = 0;       // Depth 0 = Node lá trực tiếp
};`
      },
      {
        step: 4,
        title: "4. Truy vấn hai giai đoạn & Sao chép dữ liệu",
        sub: "Kernel copy cấu trúc fiemap_extent ra User Space",
        detail: "Kernel trả về fm_mapped_extents = 1. User space cấp phát bộ nhớ động buffer, ioctl lần 2 để copy dải [4433152..4433407] về vùng nhớ tiến trình.",
        structCode: `// Kernel copy kết quả ra struct fiemap_extent:
struct fiemap_extent fe = {
    .fe_logical = 0,               // Offset logic = 0 bytes
    .fe_physical = 4433152 * 4096, // 18,158,190,592 bytes (Vật lý)
    .fe_length = 256 * 4096,       // 1,048,576 bytes (1MB)
    .fe_flags = FIEMAP_EXTENT_LAST // Extent cuối cùng
};`
      },
      {
        step: 5,
        title: "5. Định vị Khối Vật Lý & Xuất Terminal",
        sub: "Quy đổi địa chỉ byte sang số hiệu block và tính phân mảnh",
        detail: "ext4_inspect chia địa chỉ byte cho block size (4096) -> Physical Block 4433152..4433407. Đánh giá: 0 gaps -> 0% fragmentation.",
        structCode: `// Thuật toán kiểm tra tính liên tục:
uint64_t curr_phys = fe.fe_physical / block_size;
uint64_t length_blocks = fe.fe_length / block_size;
// Không có đứt gãy giữa các block -> Đánh giá HOÀN HẢO`
      }
    ]
  },

  case2: {
    id: "case2",
    name: "Case 2: Sparse File (Tệp thưa có Lỗ hổng - Holes)",
    path: "/home/thanh/ext4_test_suite/case2_sparse.dat",
    command: "./ext4_inspect /home/thanh/ext4_test_suite/case2_sparse.dat",
    badge: "Lỗ hổng (Hole) 10MB vs 12KB",
    badgeColor: "warning",
    description: "File có kích thước logic ~10MB (10,244,096 bytes) nhưng dung lượng thực tế trên đĩa chỉ tốn 12KB (3 blocks). Giữa các khối ghi là các khoảng trống logic khổng lồ không tốn block đĩa.",
    filesystem: {
      magic: "0xEF53",
      type: "EXT4 (Chuẩn hỗ trợ Extent Tree)",
      blockSize: 4096,
      totalBlocks: 5115796,
      freeBlocks: 1331439,
      totalInodes: 1310720,
      freeInodes: 1125052
    },
    metadata: {
      inode: 1053890,
      mode: "-rw-rw-r--",
      modeOctal: "0664",
      owner: "thanh (1000) / thanh (1000)",
      links: 1,
      sizeBytes: 10244096,
      sizeHuman: "9.77 MiB",
      sectors512: 24,
      diskSizeHuman: "12 KiB",
      optimalIoSize: 4096,
      timestamps: {
        btime: "2026-11-12 15:47:05.763091485",
        atime: "2026-11-12 15:47:05.763091485",
        mtime: "2026-11-12 15:47:05.771091519",
        ctime: "2026-11-12 15:47:05.771091519"
      }
    },
    extentTree: {
      header: {
        magic: "0xF30A",
        entries: 3,
        maxEntries: 4,
        depth: 0,
        generation: 0
      },
      extents: [
        {
          index: 0,
          logicalStart: 0,
          logicalEnd: 0,
          physicalStart: 1976320,
          physicalEnd: 1976320,
          lengthBlocks: 1,
          lengthBytes: 4096,
          flags: ["NONE"],
          status: "WRITTEN",
          isLast: false
        },
        {
          index: 1,
          logicalStart: 1000,
          logicalEnd: 1000,
          physicalStart: 1977320,
          physicalEnd: 1977320,
          lengthBlocks: 1,
          lengthBytes: 4096,
          flags: ["NONE"],
          status: "WRITTEN",
          isLast: false
        },
        {
          index: 2,
          logicalStart: 2500,
          logicalEnd: 2500,
          physicalStart: 1972223,
          physicalEnd: 1972223,
          lengthBlocks: 1,
          lengthBytes: 4096,
          flags: ["LAST"],
          status: "WRITTEN",
          isLast: true
        }
      ]
    },
    evaluation: {
      totalBlocks: 3,
      gaps: 2,
      fragRate: "66.7%",
      status: "BỊ PHÂN MẢNH DO LỖ HỔNG (Sparse Holes)"
    },
    ext3Comparison: {
      mechanism: "15 con trỏ i_block[15]",
      directBlocks: 1,
      indirectBlocks1: 0,
      indirectBlocks2: 2,
      indirectBlocks3: 0,
      metadataBlocksNeeded: 3,
      metadataBytes: 12288,
      ext4MetadataBytes: 36,
      savedPercent: "99.7%",
      explanation: "Ở Ext3, để trỏ đến block 1000 và 2500, hệ thống buộc phải cấp phát các block trung gian gián tiếp cấp 1 và cấp 2 để lưu mảng con trỏ rỗng (toàn số 0). Ext4 không tốn 1 byte đĩa nào cho lỗ hổng, chỉ lưu 3 extent trong Inode!"
    },
    pipelineSteps: [
      {
        step: 1,
        title: "1. Khởi tạo Sparse File",
        sub: "Lệnh lseek nhảy cách quãng (Offset 0, 1000, 2500)",
        detail: "Chương trình ghi 4KB ở offset 0, lseek nhảy đến block 1000 (4MB) ghi 4KB, nhảy đến block 2500 (10MB) ghi 4KB.",
        structCode: `// Tạo lỗ hổng (Sparse File creation)
lseek(fd, 0, SEEK_SET);      write(fd, buf, 4096);
lseek(fd, 1000 * 4096, SEEK_SET); write(fd, buf, 4096);
lseek(fd, 2500 * 4096, SEEK_SET); write(fd, buf, 4096);`
      },
      {
        step: 2,
        title: "2. statx() Đọc kích thước Logic vs Thực tế",
        sub: "Phát hiện chênh lệch stx_size và stx_blocks",
        detail: "stx_size báo 10,244,096 bytes (9.77 MiB). Tuy nhiên stx_blocks chỉ là 24 sector 512B -> Đúng 12 KiB đĩa thực tế (3 khối 4096B).",
        structCode: `// So sánh dung lượng:
uint64_t logic_size = stx.stx_size; // 10,244,096 bytes
uint64_t disk_bytes = stx.stx_blocks * 512; // 12,288 bytes (~12 KiB)
// Tiết kiệm hơn 99.8% không gian lưu trữ vật lý!`
      },
      {
        step: 3,
        title: "3. Ext4 Duyệt Cây Extent & Bỏ Qua Lỗ Hổng",
        sub: "Cơ chế quản lý Hole của Extent Tree",
        detail: "Cây Extent chỉ lưu các khoảng có dữ liệu thực: Extent 0 (block 0), Extent 1 (block 1000), Extent 2 (block 2500). Khoảng cách 1..999 và 1001..2499 được biểu diễn tự nhiên bằng sự vắng mặt của extent.",
        structCode: `// Extent Tree Node lá lưu 3 entries:
[0]: ee_block = 0,    ee_len = 1, ee_start = 1976320
[1]: ee_block = 1000, ee_len = 1, ee_start = 1977320
[2]: ee_block = 2500, ee_len = 1, ee_start = 1972223`
      },
      {
        step: 4,
        title: "4. FS_IOC_FIEMAP Trích xuất & Báo cáo Gaps",
        sub: "Xác nhận các đoạn đứt gãy logic và vật lý",
        detail: "Kernel copy 3 fiemap_extents. Thuật toán ext4_inspect phát hiện giữa Extent 0 và 1 có khoảng hổng 999 blocks; giữa Extent 1 và 2 có khoảng hổng 1499 blocks.",
        structCode: `// Phát hiện Hole trong thuật toán Inspector:
if (curr_ext.fe_logical > prev_ext.fe_logical + prev_ext.fe_length) {
    uint64_t hole_blocks = (curr_ext.fe_logical - (prev_ext.fe_logical + prev_ext.fe_length)) / 4096;
    printf("Phát hiện LỖ HỔNG (Hole): %lu blocks\\n", hole_blocks);
}`
      },
      {
        step: 5,
        title: "5. Kết luận Quản lý Khối Thưa",
        sub: "Ext4 xử lý Sparse File ưu việt hoàn hảo",
        detail: "Không cần cấp phát khối lưu con trỏ 0 như ext2/3. Đọc vùng hole kernel trả về mảng byte 0 ngay trong bộ nhớ mà không cần I/O đĩa.",
        structCode: `// Khi tiến trình đọc vùng Hole:
// Kernel VFS điền trang bộ nhớ toàn số 0 mà không đọc từ đĩa vật lý.`
      }
    ]
  },

  case3: {
    id: "case3",
    name: "Case 3: Preallocated File (fallocate - Cờ UNWRITTEN)",
    path: "/home/thanh/ext4_test_suite/case3_preallocated.dat",
    command: "./ext4_inspect /home/thanh/ext4_test_suite/case3_preallocated.dat",
    badge: "Cờ UNWRITTEN (fallocate)",
    badgeColor: "info",
    description: "File 2MB được cấp phát trước trên đĩa qua system call fallocate() nhưng chưa ghi nội dung. Khối đĩa đã được giữ chỗ trước, mang cờ UNWRITTEN để ngăn chặn đọc rò rỉ dữ liệu cũ.",
    filesystem: {
      magic: "0xEF53",
      type: "EXT4 (Chuẩn hỗ trợ Extent Tree)",
      blockSize: 4096,
      totalBlocks: 5115796,
      freeBlocks: 1331030,
      totalInodes: 1310720,
      freeInodes: 1125050
    },
    metadata: {
      inode: 1053891,
      mode: "-rw-rw-r--",
      modeOctal: "0664",
      owner: "thanh (1000) / thanh (1000)",
      links: 1,
      sizeBytes: 2097152,
      sizeHuman: "2.00 MiB",
      sectors512: 4096,
      diskSizeHuman: "2048 KiB",
      optimalIoSize: 4096,
      timestamps: {
        btime: "2026-11-12 15:47:05.779091552",
        atime: "2026-11-12 15:47:05.779091552",
        mtime: "2026-11-12 15:47:05.779359827",
        ctime: "2026-11-12 15:47:05.779359827"
      }
    },
    extentTree: {
      header: {
        magic: "0xF30A",
        entries: 1,
        maxEntries: 4,
        depth: 0,
        generation: 0
      },
      extents: [
        {
          index: 0,
          logicalStart: 0,
          logicalEnd: 511,
          physicalStart: 938496,
          physicalEnd: 939007,
          lengthBlocks: 512,
          lengthBytes: 2097152,
          flags: ["LAST", "UNWRITTEN"],
          status: "UNWRITTEN",
          isLast: true
        }
      ]
    },
    evaluation: {
      totalBlocks: 512,
      gaps: 0,
      fragRate: "0.0%",
      status: "HOÀN HẢO (100% liên tục, Trạng thái: Cấp trước Chưa ghi)"
    },
    ext3Comparison: {
      mechanism: "15 con trỏ i_block[15]",
      directBlocks: 12,
      indirectBlocks1: 500,
      indirectBlocks2: 0,
      indirectBlocks3: 0,
      metadataBlocksNeeded: 2,
      metadataBytes: 8192,
      ext4MetadataBytes: 12,
      savedPercent: "99.8%",
      explanation: "Ext3 KHÔNG hỗ trợ cờ UNWRITTEN. Để cấp phát trước 2MB trong ext3, hệ thống bắt buộc phải ghi đè 2MB số 0 xuống đĩa vật lý (gây tốn I/O và hao mòn đĩa). Ext4 chỉ cần đánh dấu bit UNWRITTEN trên extent mà không cần ghi số 0!"
    },
    pipelineSteps: [
      {
        step: 1,
        title: "1. Kích hoạt Cấp phát Trước (Preallocation)",
        sub: "System call fallocate(fd, mode, 0, 2MB)",
        detail: "Hệ thống gọi fallocate yêu cầu nhân Linux cấp phát ngay 512 blocks (2MB) liên tục trên đĩa vật lý nhưng không ghi dữ liệu payload.",
        structCode: `// Cấp phát trước 2MB liên tục:
int ret = fallocate(fd, 0, 0, 2 * 1024 * 1024);
// Không phát sinh bất kỳ thao tác ghi payload dữ liệu nào!`
      },
      {
        step: 2,
        title: "2. Ext4 Đánh Dấu Cờ UNWRITTEN trong Inode",
        sub: "Mã hóa bit quy ước trong trường ee_len",
        detail: "Trong cấu trúc ext4_extent, nếu ee_len > 32768, khối đó được hiểu là UNWRITTEN (độ dài thực = ee_len - 32768). Ở đây: ee_len = 32768 + 512 = 33280.",
        structCode: `// Ext4 Kernel Convention:
// Bit cao nhất của ee_len xác định trạng thái UNWRITTEN
if (extent->ee_len > EXT_INIT_MAX_LEN) { // > 32768
    flag |= FIEMAP_EXTENT_UNWRITTEN;
    actual_length = extent->ee_len - 32768; // 512 blocks
}`
      },
      {
        step: 3,
        title: "3. ioctl FS_IOC_FIEMAP Giải Mã Cờ",
        sub: "Nhân trả về cờ FIEMAP_EXTENT_UNWRITTEN (0x00000800)",
        detail: "ext4_inspect kiểm tra fe_flags & FIEMAP_EXTENT_UNWRITTEN. Phát hiện cờ hợp lệ, xuất thông báo cảnh báo an ninh: File đã được đặt chỗ nhưng chưa ghi.",
        structCode: `// Giải mã cờ trong ext4_inspect:
if (ext->fe_flags & FIEMAP_EXTENT_UNWRITTEN) {
    strcat(flags_str, "UNWRITTEN ");
    // Khối vật lý an toàn, không bị rò rỉ dữ liệu cũ của tiến trình khác!
}`
      },
      {
        step: 4,
        title: "4. Cơ chế Bảo Mật An Ninh Dữ Liệu Cũ",
        sub: "Ngăn chặn rò rỉ dữ liệu (Information Leakage)",
        detail: "Nếu tiến trình khác đọc file lúc này, Kernel trả về toàn số 0. Chỉ khi tiến trình thực sự ghi dữ liệu vào, extent mới được chuyển đổi (split/convert) thành WRITTEN.",
        structCode: `// Kernel read intercept:
// Mặc dù khối vật lý có thể chứa dữ liệu cũ trên đĩa,
// cờ UNWRITTEN chặn đọc trực tiếp và chỉ trả về 0.`
      },
      {
        step: 5,
        title: "5. Kết Quả Khảo Sát",
        sub: "Khối vật lý 938496..939007 được bảo lưu trọn vẹn",
        detail: "2048 KiB đĩa được cấp phát thực tế, 0% phân mảnh, sẵn sàng cho việc ghi tải trọng lớn (như Database, Virtual Machine Image).",
        structCode: `// File 100% liên tục, tối ưu I/O ghi sau này!`
      }
    ]
  },

  case4: {
    id: "case4",
    name: "Case 4: Fragmented File (Tệp đứt gãy 12 Extents phân mảnh)",
    path: "/home/thanh/ext4_test_suite/case4_fragmented.dat",
    command: "./ext4_inspect /home/thanh/ext4_test_suite/case4_fragmented.dat",
    badge: "Phân mảnh 91.7% (12 Extents)",
    badgeColor: "danger",
    description: "File được ép phân mảnh bằng kỹ thuật ghi xen kẽ liên tục giữa 2 file (interleaving writes). Tệp bị xé thành 12 extents phân tán trên các vùng đĩa vật lý cách xa nhau.",
    filesystem: {
      magic: "0xEF53",
      type: "EXT4 (Chuẩn hỗ trợ Extent Tree)",
      blockSize: 4096,
      totalBlocks: 5115796,
      freeBlocks: 1330602,
      totalInodes: 1310720,
      freeInodes: 1125050
    },
    metadata: {
      inode: 1053893,
      mode: "-rw-rw-r--",
      modeOctal: "0664",
      owner: "thanh (1000) / thanh (1000)",
      links: 1,
      sizeBytes: 1638400,
      sizeHuman: "1.56 MiB",
      sectors512: 1544,
      diskSizeHuman: "772 KiB",
      optimalIoSize: 4096,
      timestamps: {
        btime: "2026-11-12 15:47:05.790091598",
        atime: "2026-11-12 15:47:05.790091598",
        mtime: "2026-11-12 15:47:05.949092263",
        ctime: "2026-11-12 15:47:05.949092263"
      }
    },
    extentTree: {
      header: {
        magic: "0xF30A",
        entries: 12,
        maxEntries: 12,
        depth: 1,
        generation: 0
      },
      extents: [
        { index: 0,  logicalStart: 32,  logicalEnd: 47,  physicalStart: 4251632, physicalEnd: 4251647, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 1,  logicalStart: 64,  logicalEnd: 79,  physicalStart: 4236720, physicalEnd: 4236735, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 2,  logicalStart: 96,  logicalEnd: 111, physicalStart: 4237648, physicalEnd: 4237663, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 3,  logicalStart: 128, logicalEnd: 143, physicalStart: 4238128, physicalEnd: 4238143, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 4,  logicalStart: 160, logicalEnd: 175, physicalStart: 4239184, physicalEnd: 4239199, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 5,  logicalStart: 192, logicalEnd: 207, physicalStart: 4239264, physicalEnd: 4239279, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 6,  logicalStart: 224, logicalEnd: 239, physicalStart: 4239600, physicalEnd: 4239615, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 7,  logicalStart: 256, logicalEnd: 271, physicalStart: 4240112, physicalEnd: 4240127, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 8,  logicalStart: 288, logicalEnd: 303, physicalStart: 4247024, physicalEnd: 4247039, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 9,  logicalStart: 320, logicalEnd: 335, physicalStart: 4247520, physicalEnd: 4247535, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 10, logicalStart: 352, logicalEnd: 367, physicalStart: 4248192, physicalEnd: 4248207, lengthBlocks: 16, lengthBytes: 65536, flags: ["NONE"], status: "WRITTEN", isLast: false },
        { index: 11, logicalStart: 384, logicalEnd: 399, physicalStart: 4248560, physicalEnd: 4248575, lengthBlocks: 16, lengthBytes: 65536, flags: ["LAST"], status: "WRITTEN", isLast: true }
      ]
    },
    evaluation: {
      totalBlocks: 192,
      gaps: 11,
      fragRate: "91.7%",
      status: "BỊ PHÂN MẢNH NẶNG (Tỷ lệ đứt gãy đĩa: 91.7%)"
    },
    ext3Comparison: {
      mechanism: "15 con trỏ i_block[15]",
      directBlocks: 12,
      indirectBlocks1: 180,
      indirectBlocks2: 0,
      indirectBlocks3: 0,
      metadataBlocksNeeded: 2,
      metadataBytes: 8192,
      ext4MetadataBytes: 144,
      savedPercent: "98.2%",
      explanation: "Dù bị phân mảnh thành 12 extents, Ext4 vẫn lưu trữ cực kỳ gọn gàng với 12 extent (144 bytes). Đối với đĩa cơ (HDD), 11 gaps này sẽ làm đầu đọc nhảy 11 lần, làm giảm tốc độ I/O nghiêm trọng!"
    },
    pipelineSteps: [
      {
        step: 1,
        title: "1. Kịch bản Ghi Xen Kẽ (Interleaving Writes)",
        sub: "Cố tình ép bộ cấp phát khối mballoc chia cắt dữ liệu",
        detail: "Script create_test_cases.sh thực hiện vòng lặp 12 lần ghi xen kẽ giữa case4 và dummy_interleave, gọi sync ép Kernel commit xuống đĩa.",
        structCode: `for i in $(seq 1 12); do
    dd if=/dev/urandom of=case4_fragmented.dat bs=64K count=1 seek=$((i * 2)) conv=notrunc
    dd if=/dev/urandom of=dummy_interleave.dat bs=128K count=1 seek=$i conv=notrunc
    sync
done`
      },
      {
        step: 2,
        title: "2. Ext4 Extent Tree Tăng Độ Sâu (Depth = 1)",
        sub: "Vượt quá sức chứa 4 extents tại Inode Root",
        detail: "Khi số extents > 4, 60 bytes i_data tại Inode biến thành Index Node (eh_depth = 1) chứa cấu trúc ext4_extent_idx trỏ tới các block lá khác trên đĩa.",
        structCode: `// Cây Extent phân nhánh 2 cấp:
struct ext4_extent_idx {
    __le32 ei_block;   // Khối logic nhánh bắt đầu
    __le32 ei_leaf_lo; // Khối vật lý chứa các node lá
    __le16 ei_leaf_hi;
    __u16  ei_unused;
};`
      },
      {
        step: 3,
        title: "3. ioctl FS_IOC_FIEMAP Trích Xuất 12 Extents",
        sub: "Kernel duyệt toàn bộ các nhánh cây",
        detail: "Kernel copy toàn bộ mảng 12 extents ra user space buffer. Mỗi extent đại diện cho 1 dải 16 blocks (64 KiB).",
        structCode: `// fm_mapped_extents = 12
// Mỗi extent nằm cách xa nhau hàng ngàn block vật lý!`
      },
      {
        step: 4,
        title: "4. Thuật toán Đo lường Phân Mảnh",
        sub: "Tính toán số điểm nhảy vật lý (Physical Gaps)",
        detail: "ext4_inspect so sánh physical_end của extent trước với physical_start của extent sau. Nếu không liên tiếp -> Đếm 1 Gap. Tổng cộng 11 gaps trên 12 extents.",
        structCode: `// Tính toán định lượng:
if (curr.physicalStart != prev.physicalEnd + 1) {
    gaps++;
}
frag_rate = ((float)gaps / total_extents) * 100.0f; // 91.7%`
      },
      {
        step: 5,
        title: "5. Cảnh báo Hiệu Năng & Khắc Phục",
        sub: "Tác động I/O và công cụ chống phân mảnh",
        detail: "Đối với HDD, 11 gaps gây ra 11 seek operations (độ trễ ~10ms mỗi lần). Trên Ext4, có thể dùng công cụ e4defrag để gom các extents lại thành 1.",
        structCode: `// Lệnh tối ưu hoá phân mảnh trên Linux:
// sudo e4defrag /home/thanh/ext4_test_suite/case4_fragmented.dat`
      }
    ]
  }
};
