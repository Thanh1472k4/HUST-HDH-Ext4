/**
 * ============================================================================
 * ĐỒ ÁN MÔN HỌC: HỆ ĐIỀU HÀNH - ĐẠI HỌC BÁCH KHOA HÀ NỘI
 * ĐỀ TÀI 16: TÌM HIỂU EXT3/EXT4 TRÊN LINUX & XÂY DỰNG CHƯƠNG TRÌNH DÙNG API
 *            ĐỌC METADATA, INODE/EXTENT VÀ VỊ TRÍ BLOCK CỦA FILE.
 * ============================================================================
 * Sinh viên thực hiện: Lưu Thế Anh & Đỗ Minh Quân
 * Mã nguồn: ext4_inspect.c
 * Các System API cốt lõi sử dụng:
 *   1. statx() / stat()            : Đọc Inode, Metadata, Timestamps (btime)
 *   2. statfs()                    : Xác định Filesystem Magic & Block Size
 *   3. ioctl(fd, FS_IOC_FIEMAP, ..): Trích xuất Extent Tree & Physical Blocks
 * ============================================================================
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <errno.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>
#include <pwd.h>
#include <grp.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/vfs.h>
#include <sys/ioctl.h>
#include <linux/fs.h>
#include <linux/fiemap.h>

/* ext4 magic number */
#ifndef EXT4_SUPER_MAGIC
#define EXT4_SUPER_MAGIC 0xEF53
#endif

/* ANSI Color Escape Codes */
#define C_RESET       "\033[0m"
#define C_BOLD        "\033[1m"
#define C_DIM         "\033[2m"
#define C_RED         "\033[1;31m"
#define C_GREEN       "\033[1;32m"
#define C_YELLOW      "\033[1;33m"
#define C_BLUE        "\033[1;34m"
#define C_MAGENTA     "\033[1;35m"
#define C_CYAN        "\033[1;36m"
#define C_WHITE       "\033[1;37m"
#define C_BG_BLUE     "\033[44;37;1m"

/* Helper: Chuyển quyền (mode) sang chuỗi rwxrwxrwx */
static void mode_to_str(mode_t mode, char *str) {
    str[0] = S_ISDIR(mode) ? 'd' :
             S_ISLNK(mode) ? 'l' :
             S_ISCHR(mode) ? 'c' :
             S_ISBLK(mode) ? 'b' :
             S_ISFIFO(mode)? 'p' :
             S_ISSOCK(mode)? 's' : '-';
    str[1] = (mode & S_IRUSR) ? 'r' : '-';
    str[2] = (mode & S_IWUSR) ? 'w' : '-';
    str[3] = (mode & S_ISUID) ? ((mode & S_IXUSR) ? 's' : 'S') : ((mode & S_IXUSR) ? 'x' : '-');
    str[4] = (mode & S_IRGRP) ? 'r' : '-';
    str[5] = (mode & S_IWGRP) ? 'w' : '-';
    str[6] = (mode & S_ISGID) ? ((mode & S_IXGRP) ? 's' : 'S') : ((mode & S_IXGRP) ? 'x' : '-');
    str[7] = (mode & S_IROTH) ? 'r' : '-';
    str[8] = (mode & S_IWOTH) ? 'w' : '-';
    str[9] = (mode & S_ISVTX) ? ((mode & S_IXOTH) ? 't' : 'T') : ((mode & S_IXOTH) ? 'x' : '-');
    str[10] = '\0';
}

/* Helper: Định dạng timestamp dạng chuỗi YYYY-MM-DD HH:MM:SS */
static void format_time(int64_t sec, uint32_t nsec, char *buf, size_t maxlen) {
    time_t t = (time_t)sec;
    struct tm tm_val;
    if (localtime_r(&t, &tm_val)) {
        snprintf(buf, maxlen, "%04d-%02d-%02d %02d:%02d:%02d.%09u",
                 tm_val.tm_year + 1900, tm_val.tm_mon + 1, tm_val.tm_mday,
                 tm_val.tm_hour, tm_val.tm_min, tm_val.tm_sec, nsec);
    } else {
        snprintf(buf, maxlen, "N/A");
    }
}

/* Helper: Format dung lượng (bytes -> B, KiB, MiB, GiB) */
static void human_readable_size(uint64_t bytes, char *buf, size_t maxlen) {
    const char *units[] = {"B", "KiB", "MiB", "GiB", "TiB"};
    int unit_idx = 0;
    double d_bytes = (double)bytes;
    while (d_bytes >= 1024.0 && unit_idx < 4) {
        d_bytes /= 1024.0;
        unit_idx++;
    }
    if (unit_idx == 0) {
        snprintf(buf, maxlen, "%lu %s", (unsigned long)bytes, units[unit_idx]);
    } else {
        snprintf(buf, maxlen, "%.2f %s (%lu bytes)", d_bytes, units[unit_idx], (unsigned long)bytes);
    }
}

/* Helper: Giải mã cờ FIEMAP_EXTENT_* sang chuỗi tiếng Việt & tên cờ Kernel */
static void decode_fiemap_flags(uint32_t flags, char *buf, size_t maxlen) {
    buf[0] = '\0';
    if (flags & FIEMAP_EXTENT_LAST) strncat(buf, "LAST ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_UNKNOWN) strncat(buf, "UNKNOWN_LOC ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_DELALLOC) strncat(buf, "DELALLOC ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_ENCODED) strncat(buf, "ENCODED ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_DATA_ENCRYPTED) strncat(buf, "ENCRYPTED ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_NOT_ALIGNED) strncat(buf, "NOT_ALIGNED ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_DATA_INLINE) strncat(buf, "INLINE ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_DATA_TAIL) strncat(buf, "TAIL ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_UNWRITTEN) strncat(buf, "UNWRITTEN ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_MERGED) strncat(buf, "MERGED ", maxlen - strlen(buf) - 1);
    if (flags & FIEMAP_EXTENT_SHARED) strncat(buf, "SHARED ", maxlen - strlen(buf) - 1);

    if (buf[0] == '\0') {
        strncpy(buf, "NONE", maxlen);
    } else {
        /* Xóa khoảng trắng cuối cùng */
        size_t len = strlen(buf);
        if (len > 0 && buf[len - 1] == ' ') {
            buf[len - 1] = '\0';
        }
    }
}

/* In biểu ngữ tiêu đề */
static void print_banner(void) {
    printf("%s", C_CYAN);
    printf("╔══════════════════════════════════════════════════════════════════════════════════╗\n");
    printf("║         HỆ ĐIỀU HÀNH - BTL ĐỀ TÀI 16: EXT4 INODE & EXTENT INSPECTOR              ║\n");
    printf("║                  System Call Interface: statx() + FS_IOC_FIEMAP                  ║\n");
    printf("╚══════════════════════════════════════════════════════════════════════════════════╝\n");
    printf("%s\n", C_RESET);
}

/* 1. Kiểm tra Filesystem Type qua statfs() */
static bool check_filesystem(const char *path, uint64_t *fs_block_size, uint32_t *fs_type) {
    struct statfs sfs;
    if (statfs(path, &sfs) < 0) {
        perror(C_RED "[-] Lỗi khi gọi statfs()" C_RESET);
        return false;
    }

    *fs_block_size = (uint64_t)sfs.f_bsize;
    *fs_type = (uint32_t)sfs.f_type;

    printf("%s[1] THÔNG TIN PHÂN VÙNG (FILESYSTEM INFORMATION)%s\n", C_BOLD, C_RESET);
    printf("  %-28s: 0x%04X ", "Filesystem Magic Type", (unsigned int)sfs.f_type);
    if (sfs.f_type == EXT4_SUPER_MAGIC) {
        printf("%s(EXT2 / EXT3 / EXT4 - Chuẩn hỗ trợ Extent)%s\n", C_GREEN, C_RESET);
    } else {
        printf("%s(CẢNH BÁO: Không phải ext4 thuần, có thể là FUSE/tmpfs!)%s\n", C_YELLOW, C_RESET);
    }
    printf("  %-28s: %lu bytes\n", "Block Size của Filesystem", (unsigned long)sfs.f_bsize);
    printf("  %-28s: %lu blocks (Khả dụng: %lu blocks)\n", "Tổng số blocks", 
           (unsigned long)sfs.f_blocks, (unsigned long)sfs.f_bavail);
    printf("  %-28s: %lu inodes (Khả dụng: %lu inodes)\n", "Tổng số Inodes", 
           (unsigned long)sfs.f_files, (unsigned long)sfs.f_ffree);
    printf("  %-28s: %ld ký tự\n", "Độ dài tên file tối đa", (long)sfs.f_namelen);
    printf("\n");
    return true;
}

/* 2. Đọc Inode & Metadata bằng statx() */
static bool inspect_inode_metadata(const char *path, struct statx *stx_out) {
    struct statx stx;
    memset(&stx, 0, sizeof(stx));

    /* Gọi system call statx với cờ STATX_ALL */
    if (statx(AT_FDCWD, path, AT_SYMLINK_NOFOLLOW, STATX_ALL, &stx) < 0) {
        perror(C_RED "[-] Lỗi khi gọi statx()" C_RESET);
        return false;
    }
    *stx_out = stx;

    /* Lấy tên user và group */
    struct passwd *pwd = getpwuid(stx.stx_uid);
    struct group  *grp = getgrgid(stx.stx_gid);
    char user_str[64], group_str[64];
    snprintf(user_str, sizeof(user_str), "%s (%u)", pwd ? pwd->pw_name : "unknown", stx.stx_uid);
    snprintf(group_str, sizeof(group_str), "%s (%u)", grp ? grp->gr_name : "unknown", stx.stx_gid);

    char mode_str[16];
    mode_to_str(stx.stx_mode, mode_str);

    char size_str[64];
    human_readable_size(stx.stx_size, size_str, sizeof(size_str));

    char time_b[64], time_a[64], time_m[64], time_c[64];
    format_time(stx.stx_atime.tv_sec, stx.stx_atime.tv_nsec, time_a, sizeof(time_a));
    format_time(stx.stx_mtime.tv_sec, stx.stx_mtime.tv_nsec, time_m, sizeof(time_m));
    format_time(stx.stx_ctime.tv_sec, stx.stx_ctime.tv_nsec, time_c, sizeof(time_c));
    if (stx.stx_mask & STATX_BTIME) {
        format_time(stx.stx_btime.tv_sec, stx.stx_btime.tv_nsec, time_b, sizeof(time_b));
    } else {
        snprintf(time_b, sizeof(time_b), "Chưa hỗ trợ (cần inode 256 bytes+)");
    }

    printf("%s[2] INODE & FILE METADATA (TRÍCH XUẤT TỪ statx)%s\n", C_BOLD, C_RESET);
    printf("  %-28s: %s%llu%s\n", "Inode Number (i_ino)", C_YELLOW, (unsigned long long)stx.stx_ino, C_RESET);
    printf("  %-28s: %s (%04o)\n", "Quyền truy cập (Mode)", mode_str, (unsigned int)(stx.stx_mode & 07777));
    printf("  %-28s: %s / %s\n", "Sở hữu (Owner UID/GID)", user_str, group_str);
    printf("  %-28s: %u\n", "Số Hard Links (i_links_count)", stx.stx_nlink);
    printf("  %-28s: %s\n", "Kích thước logic (Size)", size_str);
    printf("  %-28s: %llu (Sector 512B) -> ~%llu KiB đĩa thực tế\n", 
           "Số blocks phân bổ (i_blocks)",
           (unsigned long long)stx.stx_blocks,
           (unsigned long long)(stx.stx_blocks * 512 / 1024));
    printf("  %-28s: %u bytes\n", "Optimal I/O Block Size", stx.stx_blksize);
    printf("  %-28s: [Major %u, Minor %u]\n", "Device ID", stx.stx_rdev_major, stx.stx_rdev_minor);

    printf("  %s\n", "── Các mốc thời gian (Timestamps - độ chính xác Nano-giây):");
    printf("    • Birth Time  (crtime) : %s\n", time_b);
    printf("    • Access Time (atime)  : %s\n", time_a);
    printf("    • Modify Time (mtime)  : %s\n", time_m);
    printf("    • Change Time (ctime)  : %s\n", time_c);
    printf("\n");
    return true;
}

/* 3. Phân tích Cây Extent bằng ioctl FS_IOC_FIEMAP */
static bool inspect_extents(int fd, uint64_t block_size) {
    printf("%s[3] CẤU TRÚC EXTENT & PHYSICAL BLOCK MAPPING (FS_IOC_FIEMAP)%s\n", C_BOLD, C_RESET);

    /* Bước 1: Dò tìm số lượng extent (probe count) */
    struct fiemap fiemap_probe;
    memset(&fiemap_probe, 0, sizeof(fiemap_probe));
    fiemap_probe.fm_start = 0;
    fiemap_probe.fm_length = FIEMAP_MAX_OFFSET;
    fiemap_probe.fm_flags = FIEMAP_FLAG_SYNC; /* Đẩy cache xuống đĩa để có physical block chuẩn */
    fiemap_probe.fm_extent_count = 0;

    if (ioctl(fd, FS_IOC_FIEMAP, &fiemap_probe) < 0) {
        if (errno == EOPNOTSUPP || errno == ENOTTY) {
            fprintf(stderr, C_RED "[-] Filesystem này không hỗ trợ ioctl FS_IOC_FIEMAP!\n"
                                  "    (Lưu ý: Hãy chắc chắn file nằm trên phân vùng ext4 thuần túy như /dev/sda2,\n"
                                  "    chứ không phải trên thư mục chia sẻ máy ảo vmhgfs-fuse/NFS/tmpfs).\n" C_RESET);
        } else {
            perror(C_RED "[-] Lỗi khi gọi ioctl(FS_IOC_FIEMAP)" C_RESET);
        }
        return false;
    }

    uint32_t num_extents = fiemap_probe.fm_mapped_extents;
    if (num_extents == 0) {
        printf("%s  [i] File rỗng (0 bytes) hoặc không có extent nào được cấp phát (sparse file hoàn toàn).%s\n\n",
               C_YELLOW, C_RESET);
        return true;
    }

    /* Bước 2: Cấp phát bộ nhớ đủ chứa toàn bộ extents */
    size_t alloc_size = sizeof(struct fiemap) + (num_extents * sizeof(struct fiemap_extent));
    struct fiemap *fiemap = (struct fiemap *)malloc(alloc_size);
    if (!fiemap) {
        perror(C_RED "[-] Lỗi cấp phát bộ nhớ cho fiemap" C_RESET);
        return false;
    }

    memset(fiemap, 0, alloc_size);
    fiemap->fm_start = 0;
    fiemap->fm_length = FIEMAP_MAX_OFFSET;
    fiemap->fm_flags = FIEMAP_FLAG_SYNC;
    fiemap->fm_extent_count = num_extents;

    if (ioctl(fd, FS_IOC_FIEMAP, fiemap) < 0) {
        perror(C_RED "[-] Lỗi lấy danh sách extents từ ioctl" C_RESET);
        free(fiemap);
        return false;
    }

    /* In bảng Extent chuẩn ANSI */
    printf("  Tổng số Extents: %s%u%s\n", C_GREEN, fiemap->fm_mapped_extents, C_RESET);
    printf("  %s┌──────┬─────────────────────────┬─────────────────────────┬──────────────┬────────────────────────┐%s\n", C_CYAN, C_RESET);
    printf("  %s│ Ext# │ Logical Offset [Blocks] │ Physical Offset [Blocks]│ Length (Blk) │ Cờ thuộc tính (Flags)  │%s\n", C_CYAN, C_RESET);
    printf("  %s├──────┼─────────────────────────┼─────────────────────────┼──────────────┼────────────────────────┤%s\n", C_CYAN, C_RESET);

    uint64_t total_blocks = 0;
    uint32_t discontinuities = 0;
    uint64_t prev_physical_end = 0;

    for (uint32_t i = 0; i < fiemap->fm_mapped_extents; i++) {
        struct fiemap_extent *ext = &fiemap->fm_extents[i];

        uint64_t log_blk_start = ext->fe_logical / block_size;
        uint64_t log_blk_end   = (ext->fe_logical + ext->fe_length - 1) / block_size;
        uint64_t phy_blk_start = ext->fe_physical / block_size;
        uint64_t phy_blk_end   = (ext->fe_physical + ext->fe_length - 1) / block_size;
        uint64_t blk_count     = ext->fe_length / block_size;
        total_blocks += blk_count;

        /* Kiểm tra tính liên tục của các extent trên đĩa cứng */
        if (i > 0) {
            if (phy_blk_start != prev_physical_end + 1) {
                discontinuities++;
            }
        }
        prev_physical_end = phy_blk_end;

        char flags_desc[128];
        decode_fiemap_flags(ext->fe_flags, flags_desc, sizeof(flags_desc));

        char log_str[32], phy_str[32];
        snprintf(log_str, sizeof(log_str), "%lu..%lu", (unsigned long)log_blk_start, (unsigned long)log_blk_end);
        snprintf(phy_str, sizeof(phy_str), "%lu..%lu", (unsigned long)phy_blk_start, (unsigned long)phy_blk_end);

        printf("  │ %4u │ %-23s │ %-23s │ %12lu │ %-22s │\n",
               i, log_str, phy_str, (unsigned long)blk_count, flags_desc);
    }
    printf("  %s└──────┴─────────────────────────┴─────────────────────────┴──────────────┴────────────────────────┘%s\n", C_CYAN, C_RESET);

    /* Đánh giá độ phân mảnh */
    printf("\n  %s[Đánh giá cấu trúc lưu trữ]%s\n", C_BOLD, C_RESET);
    printf("    • Tổng số block vật lý quản lý : %lu blocks (~%lu KiB)\n", 
           (unsigned long)total_blocks, (unsigned long)(total_blocks * block_size / 1024));
    printf("    • Số đoạn đứt gãy (Gaps)       : %u\n", discontinuities);
    if (discontinuities == 0 && fiemap->fm_mapped_extents > 0) {
        printf("    • Đánh giá phân mảnh           : %sHOÀN HẢO (100%% liên tục trên đĩa, 0%% Fragmentation)%s\n",
               C_GREEN, C_RESET);
    } else {
        double frag_ratio = ((double)discontinuities / (double)fiemap->fm_mapped_extents) * 100.0;
        printf("    • Đánh giá phân mảnh           : %sBỊ PHÂN MẢNH (Tỷ lệ đứt gãy: %.1f%%)%s\n",
               C_YELLOW, frag_ratio, C_RESET);
    }
    printf("\n");

    free(fiemap);
    return true;
}

/* In hướng dẫn đối chứng với lệnh hệ thống */
static void print_cross_check_guide(const char *path, uint64_t inode_num) {
    printf("%s[4] HƯỚNG DẪN ĐỐI CHỨNG VỚI CÔNG CỤ HỆ THỐNG LINUX%s\n", C_BOLD, C_RESET);
    printf("  Để chứng minh tính chính xác tuyệt đối trong báo cáo & buổi bảo vệ, hãy chạy:\n\n");
    printf("  1. Đối chứng Extent & Blocks bằng lệnh %sfilefrag%s:\n", C_CYAN, C_RESET);
    printf("     %sfilefrag -v -b4096 %s%s\n\n", C_YELLOW, path, C_RESET);

    printf("  2. Đối chứng Inode & Metadata trực tiếp từ đĩa bằng %sdebugfs%s (quyền root):\n", C_CYAN, C_RESET);
    printf("     %ssudo debugfs -R \"stat <%llu>\" /dev/sda2%s\n", C_YELLOW, (unsigned long long)inode_num, C_RESET);
    printf("     %ssudo debugfs -R \"stat %s\" /dev/sda2%s\n\n", C_YELLOW, path, C_RESET);
}

int main(int argc, char *argv[]) {
    print_banner();

    if (argc < 2) {
        fprintf(stderr, "%sSử dụng: %s <đường dẫn file cần phân tích>%s\n", C_RED, argv[0], C_RESET);
        fprintf(stderr, "Ví dụ   : %s /home/thanh/test_sample.txt\n\n", argv[0]);
        return EXIT_FAILURE;
    }

    const char *path = argv[1];
    printf(">> Đang phân tích mục tiêu: %s%s%s\n\n", C_BOLD, path, C_RESET);

    /* 1. Mở file */
    int fd = open(path, O_RDONLY | O_LARGEFILE);
    if (fd < 0) {
        fprintf(stderr, C_RED "[-] Không thể mở file '%s': %s\n" C_RESET, path, strerror(errno));
        return EXIT_FAILURE;
    }

    /* 2. Kiểm tra Filesystem Type */
    uint64_t block_size = 4096;
    uint32_t fs_type = 0;
    if (!check_filesystem(path, &block_size, &fs_type)) {
        close(fd);
        return EXIT_FAILURE;
    }

    /* 3. Đọc Inode & Metadata */
    struct statx stx;
    if (!inspect_inode_metadata(path, &stx)) {
        close(fd);
        return EXIT_FAILURE;
    }

    /* 4. Đọc Extents & Blocks (chỉ áp dụng cho regular file) */
    if (S_ISREG(stx.stx_mode)) {
        inspect_extents(fd, block_size);
    } else {
        printf("%s[!] Đối tượng không phải Regular File (có thể là Directory, Symlink, Device). Bỏ qua đọc extent.%s\n\n",
               C_YELLOW, C_RESET);
    }

    /* 5. Gợi ý lệnh đối chứng */
    print_cross_check_guide(path, stx.stx_ino);

    close(fd);
    return EXIT_SUCCESS;
}
