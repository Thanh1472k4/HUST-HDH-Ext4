/**
 * APP.JS - Ứng dụng điều khiển trung tâm
 * Hỗ trợ Thanh kéo co giãn (Resizable Splitter), Công tắc Wrap text, và Nút Reset chạy lại toàn bộ
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Khởi tạo Terminal Mirror
  const terminal = new TerminalMirror('terminalBody');

  // 2. Khởi tạo Data Pipeline (Đóng gói & Chuyển dữ liệu)
  const pipeline = new DataPipeline({
    nodesContainerId: 'pipelineNodes',
    inspectorTitleId: 'pipelineStepTitle',
    inspectorDescId: 'pipelineStepDesc',
    inspectorCodeId: 'pipelineStepCode',
    stepBadgeId: 'pipelineStepBadge',
    onStepChange: (stepIdx, stepData, currentCase) => {
      const card1 = document.getElementById('cardPipeline');
      if (card1 && card1.classList.contains('collapsed')) {
        card1.classList.remove('collapsed');
      }
    }
  });

  // 3. Khởi tạo Visualizer
  const visualizer = new SystemVisualizer({
    inodeTableId: 'inodeTableBody',
    treeHeaderId: 'extentTreeHeader',
    treeLeavesId: 'extentTreeLeaves',
    diskStripId: 'diskBlockStrip',
    ext3CardId: 'ext3CompareCard',
    ext4CardId: 'ext4CompareCard'
  });

  let activeCaseKey = 'case1';

  // 4. Xử lý Thanh Kéo Co Giãn Chiều Rộng (Resizable Splitter Gutter)
  const gutter = document.getElementById('gutterResizer');
  const savedWidth = localStorage.getItem('ext4_term_width');
  if (savedWidth) {
    document.documentElement.style.setProperty('--left-pane-width', `${savedWidth}px`);
  }

  if (gutter) {
    let isResizing = false;

    gutter.addEventListener('mousedown', (e) => {
      isResizing = true;
      gutter.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const minW = 320;
      const maxW = window.innerWidth - 380;
      let newW = Math.max(minW, Math.min(e.clientX, maxW));
      document.documentElement.style.setProperty('--left-pane-width', `${newW}px`);
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        gutter.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Lưu lại kích thước vào localStorage cho lần mở web sau
        const currentW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--left-pane-width'));
        if (currentW) {
          localStorage.setItem('ext4_term_width', currentW);
        }
      }
    });
  }

  // 5. Xử lý Công Tắc Gạt Mini: Tự động xuống dòng (Wrap text)
  const wrapToggle = document.getElementById('termWrapToggle');
  const terminalBody = document.getElementById('terminalBody');
  const savedWrap = localStorage.getItem('ext4_term_wrap');

  if (wrapToggle && terminalBody) {
    // Khôi phục tùy chọn trước đó nếu có
    if (savedWrap === 'true') {
      wrapToggle.checked = true;
      terminalBody.classList.add('wrap-enabled');
    }

    wrapToggle.addEventListener('change', () => {
      if (wrapToggle.checked) {
        terminalBody.classList.add('wrap-enabled');
        localStorage.setItem('ext4_term_wrap', 'true');
      } else {
        terminalBody.classList.remove('wrap-enabled');
        localStorage.setItem('ext4_term_wrap', 'false');
      }
    });
  }

  // 6. Xử lý Accordion: Thu gọn / Mở rộng các ô bên phải
  document.querySelectorAll('.vis-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.vis-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');

  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      document.querySelectorAll('.vis-card').forEach(card => card.classList.remove('collapsed'));
    });
  }

  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      document.querySelectorAll('.vis-card').forEach(card => card.classList.add('collapsed'));
    });
  }

  // 7. Hàm chuyển đổi kịch bản kiểm thử
  function switchCase(caseKey, autoRun = true) {
    activeCaseKey = caseKey;
    const caseData = TEST_CASES_DATA[caseKey];
    if (!caseData) return;

    document.querySelectorAll('.case-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.case === caseKey);
    });

    pipeline.loadCase(caseData);
    visualizer.render(caseData);

    if (autoRun) {
      runInspectionTerminal(caseData);
      pipeline.play();
    }
  }

  // Chạy lệnh ext4_inspect trên terminal
  function runInspectionTerminal(caseData) {
    const meta = caseData.metadata;
    const fs = caseData.filesystem;
    const tree = caseData.extentTree;
    const ev = caseData.evaluation;

    const lines = [
      "╔══════════════════════════════════════════════════════════════════════════════════╗",
      "║         HỆ ĐIỀU HÀNH - BTL ĐỀ TÀI 16: EXT4 INODE & EXTENT INSPECTOR              ║",
      "║                  System Call Interface: statx() + FS_IOC_FIEMAP                  ║",
      "╚══════════════════════════════════════════════════════════════════════════════════╝",
      "",
      `>> Đang phân tích mục tiêu: ${caseData.path}`,
      "",
      "[1] THÔNG TIN PHÂN VÙNG (FILESYSTEM INFORMATION)",
      `  Filesystem Magic Type       : ${fs.magic} (${fs.type})`,
      `  Block Size của Filesystem : ${fs.blockSize} bytes`,
      `  Tổng số blocks          : ${fs.totalBlocks.toLocaleString()} blocks (Khả dụng: ${fs.freeBlocks.toLocaleString()} blocks)`,
      `  Tổng số Inodes          : ${fs.totalInodes.toLocaleString()} inodes (Khả dụng: ${fs.freeInodes.toLocaleString()} inodes)`,
      "  Độ dài tên file tối đa: 255 ký tự",
      "",
      "[2] INODE & FILE METADATA (TRÍCH XUẤT TỪ statx)",
      `  Inode Number (i_ino)        : ${meta.inode}`,
      `  Quyền truy cập (Mode)   : ${meta.mode} (${meta.modeOctal})`,
      `  Sở hữu (Owner UID/GID)  : ${meta.owner}`,
      `  Số Hard Links (i_links_count): ${meta.links}`,
      `  Kích thước logic (Size) : ${meta.sizeHuman} (${meta.sizeBytes.toLocaleString()} bytes)`,
      `  Số blocks phân bổ (i_blocks): ${meta.sectors512} (Sector 512B) -> ~${meta.diskSizeHuman} đĩa thực tế`,
      `  Optimal I/O Block Size      : ${meta.optimalIoSize} bytes`,
      "  ── Các mốc thời gian (Timestamps - độ chính xác Nano-giây):",
      `    • Birth Time  (crtime) : ${meta.timestamps.btime}`,
      `    • Access Time (atime)  : ${meta.timestamps.atime}`,
      `    • Modify Time (mtime)  : ${meta.timestamps.mtime}`,
      `    • Change Time (ctime)  : ${meta.timestamps.ctime}`,
      "",
      "[3] CẤU TRÚC EXTENT & PHYSICAL BLOCK MAPPING (FS_IOC_FIEMAP)",
      `  Tổng số Extents: ${tree.extents.length}`,
      "  ┌──────┬─────────────────────────┬─────────────────────────┬──────────────┬────────────────────────┐",
      "  │ Ext# │ Logical Offset [Blocks] │ Physical Offset [Blocks]│ Length (Blk) │ Cờ thuộc tính (Flags)  │",
      "  ├──────┼─────────────────────────┼─────────────────────────┼──────────────┼────────────────────────┤"
    ];

    tree.extents.forEach(e => {
      const idxStr = String(e.index).padStart(4, ' ');
      const logStr = `${e.logicalStart}..${e.logicalEnd}`.padEnd(23, ' ');
      const physStr = `${e.physicalStart}..${e.physicalEnd}`.padEnd(23, ' ');
      const lenStr = String(e.lengthBlocks).padStart(12, ' ');
      const flagsStr = e.flags.join(' ').padEnd(22, ' ');
      lines.push(`  │ ${idxStr} │ ${logStr} │ ${physStr} │ ${lenStr} │ ${flagsStr} │`);
    });

    lines.push("  └──────┴─────────────────────────┴─────────────────────────┴──────────────┴────────────────────────┘");
    lines.push("");
    lines.push("  [Đánh giá cấu trúc lưu trữ]");
    lines.push(`    • Tổng số block vật lý quản lý : ${ev.totalBlocks} blocks`);
    lines.push(`    • Số đoạn đứt gãy (Gaps)       : ${ev.gaps}`);
    lines.push(`    • Đánh giá phân mảnh           : ${ev.status} (${ev.fragRate} Fragmentation)`);
    lines.push("");
    lines.push("[4] HƯỚNG DẪN ĐỐI CHỨNG VỚI CÔNG CỤ HỆ THỐNG LINUX");
    lines.push(`  1. filefrag -v -b4096 ${caseData.path}`);
    lines.push(`  2. sudo debugfs -R "stat <${meta.inode}>" /dev/sda2`);
    lines.push("");

    terminal.typeCommand(caseData.command, lines);
  }

  // Lắng nghe click chọn 4 Case
  document.querySelectorAll('.case-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCase(btn.dataset.case, true);
    });
  });

  // 8. Điều khiển Play / Pause / Step / Reset
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnNext = document.getElementById('btnNext');
  const btnReset = document.getElementById('btnReset');
  const speedSelect = document.getElementById('speedSelect');

  btnPlay.addEventListener('click', () => {
    pipeline.play();
  });

  btnPause.addEventListener('click', () => {
    pipeline.pause();
  });

  btnNext.addEventListener('click', () => {
    pipeline.next();
  });

  // NÚT RESET: Xóa log cũ, đưa pipeline về đầu và chạy lại toàn bộ từ đầu
  btnReset.addEventListener('click', () => {
    pipeline.pause();
    terminal.clear();
    pipeline.reset();
    setTimeout(() => {
      runInspectionTerminal(TEST_CASES_DATA[activeCaseKey]);
      pipeline.play();
    }, 120);
  });

  speedSelect.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    pipeline.setSpeed(val);
    terminal.setSpeed(val);
  });

  // 9. Lệnh đối chứng nhanh dưới Terminal
  document.getElementById('cmdInspect').addEventListener('click', () => {
    terminal.clear();
    runInspectionTerminal(TEST_CASES_DATA[activeCaseKey]);
    pipeline.play();
  });

  document.getElementById('cmdFilefrag').addEventListener('click', () => {
    const caseData = TEST_CASES_DATA[activeCaseKey];
    const lines = [
      `Filesystem type is: ef53`,
      `File size of ${caseData.path} is ${caseData.metadata.sizeBytes} (${caseData.extentTree.extents.reduce((a, b) => a + b.lengthBlocks, 0)} blocks of 4096 bytes)`,
      ` ext:     logical_offset:        physical_offset: length:   expected: flags:`,
    ];
    caseData.extentTree.extents.forEach(e => {
      lines.push(`   ${e.index}:        ${e.logicalStart}..     ${e.logicalEnd}:    ${e.physicalStart}..   ${e.physicalEnd}:    ${e.lengthBlocks}:             ${e.flags.join(',')}`);
    });
    lines.push(`${caseData.path}: ${caseData.extentTree.extents.length} extent(s) found`);
    terminal.typeCommand(`filefrag -v -b4096 ${caseData.path}`, lines);
  });

  document.getElementById('cmdDebugfs').addEventListener('click', () => {
    const caseData = TEST_CASES_DATA[activeCaseKey];
    const meta = caseData.metadata;
    const lines = [
      `debugfs 1.46.5 (30-Dec-2021)`,
      `Inode: ${meta.inode}   Type: regular    Mode:  ${meta.modeOctal}   Flags: 0x80000 (extents)`,
      `Generation: 1238912    Version: 0x00000000:00000001`,
      `User:  1000   Group:  1000   Project:     0   Size: ${meta.sizeBytes}`,
      `File ACL: 0`,
      `Links: ${meta.links}   Blockcount: ${meta.sectors512}`,
      `Fragment:  Address: 0    Number: 0    Size: 0`,
      ` ctime: 0x67332c91:b2413244 -- ${meta.timestamps.ctime}`,
      ` atime: 0x67332c91:b2413244 -- ${meta.timestamps.atime}`,
      ` mtime: 0x67332c91:b2413244 -- ${meta.timestamps.mtime}`,
      `crtime: 0x67332c91:b2413244 -- ${meta.timestamps.btime}`,
      `EXTENTS:`,
      ` (0-${caseData.extentTree.extents[0].lengthBlocks - 1}): ${caseData.extentTree.extents[0].physicalStart}-${caseData.extentTree.extents[0].physicalEnd}`
    ];
    terminal.typeCommand(`sudo debugfs -R "stat <${meta.inode}>" /dev/sda2`, lines);
  });

  document.getElementById('btnClearTerm').addEventListener('click', () => {
    terminal.clear();
  });

  // 10. Nút Dừng Server Python hoàn toàn ngay trên giao diện Web
  const btnShutdown = document.getElementById('btnShutdown');
  if (btnShutdown) {
    btnShutdown.addEventListener('click', async () => {
      if (confirm('Bạn có muốn tắt hoàn toàn Python Server không?\nSau khi tắt, cổng 8080 sẽ được giải phóng và không còn tiến trình nào chạy ngầm.')) {
        btnShutdown.textContent = 'Đang dừng...';
        btnShutdown.disabled = true;
        try {
          await fetch('/shutdown');
        } catch (e) {}
        alert('Đã tắt Python Server thành công! Không còn tiến trình nào chạy ngầm.\nBạn có thể đóng tab trình duyệt này.');
        window.close();
      }
    });
  }

  // Khởi động mặc định với Case 1
  const cardInode = document.getElementById('cardInode');
  const cardCompare = document.getElementById('cardCompare');
  if (cardInode) cardInode.classList.add('collapsed');
  if (cardCompare) cardCompare.classList.add('collapsed');

  switchCase('case1', true);
});
