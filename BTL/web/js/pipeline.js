/**
 * PIPELINE.JS - Data Packaging & Transit Engine
 * Minh họa trực quan dòng chảy dữ liệu qua từng lớp hệ điều hành theo thời gian thực
 */

class DataPipeline {
  constructor(options) {
    this.nodesContainer = document.getElementById(options.nodesContainerId);
    this.inspectorTitle = document.getElementById(options.inspectorTitleId);
    this.inspectorDesc = document.getElementById(options.inspectorDescId);
    this.inspectorCode = document.getElementById(options.inspectorCodeId);
    this.stepBadge = document.getElementById(options.stepBadgeId || 'pipelineStepBadge');
    this.playBtn = document.getElementById('btnPlay');
    this.onStepChange = options.onStepChange || null;

    this.currentCase = null;
    this.currentStep = 0;
    this.isPlaying = false;
    this.timer = null;
    this.speedMultiplier = 1.0;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  loadCase(caseData) {
    this.currentCase = caseData;
    this.currentStep = 0;
    this.pause();
    this.renderNodes();
    this.showStep(0);
  }

  renderNodes() {
    if (!this.currentCase || !this.currentCase.pipelineSteps) return;
    this.nodesContainer.innerHTML = '';

    const layerLabels = [
      "User Space (Ring 3)",
      "Syscall Boundary",
      "VFS & Ext4 Driver",
      "Two-Phase Copy",
      "Block Layer & Disk"
    ];

    this.currentCase.pipelineSteps.forEach((s, idx) => {
      const node = document.createElement('div');
      node.className = `step-node ${idx === 0 ? 'active' : ''}`;
      node.dataset.step = idx;
      node.innerHTML = `
        <div class="node-layer">${layerLabels[idx] || 'Kernel'}</div>
        <div class="node-title">${s.title.split('. ')[1] || s.title}</div>
        <div class="node-status"></div>
      `;
      node.addEventListener('click', () => {
        this.pause();
        this.showStep(idx);
      });
      this.nodesContainer.appendChild(node);
    });
  }

  showStep(idx) {
    if (!this.currentCase || !this.currentCase.pipelineSteps) return;
    if (idx < 0 || idx >= this.currentCase.pipelineSteps.length) return;

    this.currentStep = idx;

    // Cập nhật trạng thái active & completed trên từng node
    const nodes = this.nodesContainer.querySelectorAll('.step-node');
    nodes.forEach((n, i) => {
      n.classList.remove('active');
      if (i < idx) {
        n.classList.add('completed');
      } else {
        n.classList.remove('completed');
      }
      if (i === idx) {
        n.classList.add('active');
      }
    });

    const stepData = this.currentCase.pipelineSteps[idx];
    this.inspectorTitle.textContent = `${stepData.title} [${stepData.sub}]`;
    this.inspectorDesc.textContent = stepData.detail;
    this.inspectorCode.textContent = stepData.structCode;

    // Cập nhật badge hiển thị số bước
    if (this.stepBadge) {
      this.stepBadge.textContent = `Bước ${idx + 1} / ${this.currentCase.pipelineSteps.length}`;
    }

    if (this.onStepChange) {
      this.onStepChange(idx, stepData, this.currentCase);
    }
  }

  play() {
    if (!this.currentCase) return;

    // Nếu đang ở bước cuối cùng, tự động quay lại bước 0 để bắt đầu chạy vòng mới
    if (this.currentStep >= this.currentCase.pipelineSteps.length - 1) {
      this.currentStep = 0;
      this.showStep(0);
    }

    this.isPlaying = true;
    this.updatePlayBtnUI();

    const interval = Math.max(1200, 2600 / this.speedMultiplier);

    const stepTick = () => {
      if (!this.isPlaying) return;

      if (this.currentStep < this.currentCase.pipelineSteps.length - 1) {
        this.showStep(this.currentStep + 1);
        this.timer = setTimeout(stepTick, interval);
      } else {
        this.pause();
      }
    };

    this.timer = setTimeout(stepTick, interval);
  }

  pause() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updatePlayBtnUI();
  }

  next() {
    this.pause();
    if (!this.currentCase) return;
    if (this.currentStep < this.currentCase.pipelineSteps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      // Nếu đã ở bước cuối, bấm Step sẽ quay lại bước 1
      this.showStep(0);
    }
  }

  prev() {
    this.pause();
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  reset() {
    this.pause();
    this.showStep(0);
  }

  updatePlayBtnUI() {
    if (!this.playBtn) return;
    if (this.isPlaying) {
      this.playBtn.innerHTML = '▶ Đang chạy...';
      this.playBtn.classList.add('playing');
    } else {
      this.playBtn.innerHTML = '▶ Play';
      this.playBtn.classList.remove('playing');
    }
  }
}

window.DataPipeline = DataPipeline;
