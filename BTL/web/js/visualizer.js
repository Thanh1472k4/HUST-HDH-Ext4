/**
 * VISUALIZER.JS - Ext4 Inode, Extent Tree & Disk Layout Renderer
 * Trực quan hóa cấu trúc dữ liệu trên đĩa và công cụ so sánh đối chứng
 */

class SystemVisualizer {
  constructor(containers) {
    this.inodeTable = document.getElementById(containers.inodeTableId);
    this.treeHeader = document.getElementById(containers.treeHeaderId);
    this.treeLeaves = document.getElementById(containers.treeLeavesId);
    this.diskStrip = document.getElementById(containers.diskStripId);
    this.ext3Card = document.getElementById(containers.ext3CardId);
    this.ext4Card = document.getElementById(containers.ext4CardId);
  }

  render(caseData) {
    this.renderInode(caseData.metadata, caseData.filesystem);
    this.renderExtentTree(caseData.extentTree);
    this.renderDiskLayout(caseData);
    this.renderComparison(caseData.ext3Comparison, caseData);
  }

  renderInode(meta, fs) {
    this.inodeTable.innerHTML = `
      <tr>
        <td class="label">Inode Number (i_ino)</td>
        <td class="val">${meta.inode}</td>
      </tr>
      <tr>
        <td class="label">Quyền (Mode)</td>
        <td class="val">${meta.mode} (${meta.modeOctal})</td>
      </tr>
      <tr>
        <td class="label">Chủ sở hữu (UID/GID)</td>
        <td class="val">${meta.owner}</td>
      </tr>
      <tr>
        <td class="label">Kích thước Logic</td>
        <td class="val">${meta.sizeHuman} (${meta.sizeBytes.toLocaleString()} bytes)</td>
      </tr>
      <tr>
        <td class="label">Khối đĩa thực (512B)</td>
        <td class="val">${meta.sectors512} sectors ➔ <b>${meta.diskSizeHuman}</b></td>
      </tr>
      <tr>
        <td class="label">Optimal I/O Block</td>
        <td class="val">${meta.optimalIoSize} bytes</td>
      </tr>
      <tr class="highlight">
        <td class="label">Vùng i_data[60]</td>
        <td class="val">EXT4 Extent Root Header & Leaves</td>
      </tr>
      <tr>
        <td class="label">Birth Time (crtime)</td>
        <td class="val" style="color: #38bdf8;">${meta.timestamps.btime}</td>
      </tr>
      <tr>
        <td class="label">Modify Time (mtime)</td>
        <td class="val">${meta.timestamps.mtime}</td>
      </tr>
      <tr>
        <td class="label">Change Time (ctime)</td>
        <td class="val">${meta.timestamps.ctime}</td>
      </tr>
    `;
  }

  renderExtentTree(tree) {
    const hdr = tree.header;
    this.treeHeader.innerHTML = `
      <div><b>eh_magic:</b> <span style="color:#10b981;">${hdr.magic}</span> (EXT4_EXT_MAGIC)</div>
      <div><b>eh_entries:</b> ${hdr.entries}</div>
      <div><b>eh_max:</b> ${hdr.maxEntries}</div>
      <div><b>eh_depth:</b> ${hdr.depth} (${hdr.depth === 0 ? 'Leaf Nodes' : 'Index Nodes'})</div>
    `;

    this.treeLeaves.innerHTML = '';
    tree.extents.forEach((ext) => {
      const item = document.createElement('div');
      item.className = 'tree-leaf-item';
      
      let flagBadges = ext.flags.map(f => {
        if (f === 'LAST') return '<span class="badge-pill warning" style="font-size:9px;">LAST</span>';
        if (f === 'UNWRITTEN') return '<span class="badge-pill info" style="font-size:9px;">UNWRITTEN</span>';
        return '<span class="badge-pill" style="font-size:9px; background:#1e293b; color:#94a3b8;">NONE</span>';
      }).join(' ');

      item.innerHTML = `
        <span style="color:#64748b;">#${ext.index}</span>
        <span style="color:#38bdf8;">Blk ${ext.logicalStart}..${ext.logicalEnd}</span>
        <span style="color:#10b981;">PBN ${ext.physicalStart}..${ext.physicalEnd}</span>
        <span style="color:#f1f5f9;">${ext.lengthBlocks} blks</span>
        <div>${flagBadges}</div>
      `;
      this.treeLeaves.appendChild(item);
    });
  }

  renderDiskLayout(caseData) {
    this.diskStrip.innerHTML = '';
    const extents = caseData.extentTree.extents;

    for (let i = 0; i < extents.length; i++) {
      const ext = extents[i];

      // Check if there is a hole before this extent (Sparse file)
      if (i > 0) {
        const prevExt = extents[i - 1];
        if (ext.logicalStart > prevExt.logicalEnd + 1) {
          const holeBlocks = ext.logicalStart - (prevExt.logicalEnd + 1);
          const holeChip = document.createElement('div');
          holeChip.className = 'block-chip sparse-hole';
          holeChip.innerHTML = `
            <div>HOLE</div>
            <div style="font-size:9px;">+${holeBlocks} blks rỗng</div>
            <div class="block-tooltip">Lỗ hổng Logic: Khối ${prevExt.logicalEnd + 1}..${ext.logicalStart - 1} (${(holeBlocks * 4).toLocaleString()} KB)<br>Không tốn dung lượng đĩa vật lý (0 bytes)</div>
          `;
          this.diskStrip.appendChild(holeChip);
        } else if (ext.physicalStart !== prevExt.physicalEnd + 1) {
          // Physical Gap (Fragmentation)
          const gapBlocks = ext.physicalStart - (prevExt.physicalEnd + 1);
          const gapDiv = document.createElement('div');
          gapDiv.className = 'gap-indicator';
          gapDiv.innerHTML = `⇄ GAP (+${Math.abs(gapBlocks).toLocaleString()} PBN)`;
          this.diskStrip.appendChild(gapDiv);
        }
      }

      // Render Extent Block Chip
      const chip = document.createElement('div');
      let typeClass = 'contiguous';
      if (ext.status === 'UNWRITTEN') typeClass = 'unwritten';
      else if (caseData.id === 'case4') typeClass = 'fragment';

      chip.className = `block-chip ${typeClass}`;
      chip.innerHTML = `
        <div style="font-weight:600;">Ext #${ext.index}</div>
        <div style="font-size:9px;">${ext.lengthBlocks} blk</div>
        <div class="block-tooltip">
          <b>Extent #${ext.index} (${ext.status})</b><br>
          • Logical Blocks: ${ext.logicalStart} .. ${ext.logicalEnd}<br>
          • Physical Blocks: ${ext.physicalStart} .. ${ext.physicalEnd}<br>
          • Kích thước: ${ext.lengthBlocks} blocks (${(ext.lengthBytes / 1024).toFixed(1)} KiB)<br>
          • Cờ: ${ext.flags.join(', ')}
        </div>
      `;
      this.diskStrip.appendChild(chip);
    }
  }

  renderComparison(comp, caseData) {
    this.ext3Card.innerHTML = `
      <div class="compare-header">
        <h4 style="color:#f59e0b;">Kiến trúc Ext2 / Ext3</h4>
        <span class="badge-pill warning" style="font-size:10px;">i_block[15]</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Cơ chế quản lý</span>
        <span class="stat-val">${comp.mechanism}</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Con trỏ Direct (Trực tiếp)</span>
        <span class="stat-val">${comp.directBlocks} blocks (Tối đa 12)</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Con trỏ Indirect (Gián tiếp)</span>
        <span class="stat-val">${comp.indirectBlocks1} blocks</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Khối metadata phụ tốn thêm</span>
        <span class="stat-val" style="color:#f87171;">+${comp.metadataBlocksNeeded} blocks (${(comp.metadataBytes / 1024).toFixed(1)} KB)</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Hỗ trợ cờ UNWRITTEN</span>
        <span class="stat-val" style="color:#f87171;">KHÔNG (Phải ghi đè số 0)</span>
      </div>
      <div class="compare-note">${comp.explanation}</div>
    `;

    this.ext4Card.innerHTML = `
      <div class="compare-header">
        <h4 style="color:#10b981;">Kiến trúc Ext4 Hiện đại</h4>
        <span class="badge-pill success" style="font-size:10px;">Extent Tree (H-Tree)</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Cơ chế quản lý</span>
        <span class="stat-val">Cây Extent [Logical, Physical, Len]</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Số lượng Extents dùng</span>
        <span class="stat-val" style="color:#10b981;">${caseData.extentTree.extents.length} Extent(s)</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Độ sâu cây (eh_depth)</span>
        <span class="stat-val">${caseData.extentTree.header.depth}</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Chi phí Metadata Extent</span>
        <span class="stat-val" style="color:#10b981;">Chỉ ${comp.ext4MetadataBytes} bytes (Gói gọn trong Inode)</span>
      </div>
      <div class="compare-stat-row">
        <span class="stat-label">Tiết kiệm Metadata I/O</span>
        <span class="stat-val" style="color:#38bdf8;">Giảm ${comp.savedPercent} I/O overhead</span>
      </div>
      <div class="compare-note">Khối vật lý 48-bit, hỗ trợ cấp phát trễ (delayed allocation) và fallocate với cờ UNWRITTEN an toàn tuyệt đối.</div>
    `;
  }
}

window.SystemVisualizer = SystemVisualizer;
