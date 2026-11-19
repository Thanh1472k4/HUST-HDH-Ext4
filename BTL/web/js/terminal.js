/**
 * TERMINAL.JS - Terminal Emulator Mirror
 * Phản chiếu giao diện dòng lệnh Linux trên Ubuntu
 */

class TerminalMirror {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isTyping = false;
    this.speedMultiplier = 1;
    this.promptPrefix = '<span class="terminal-prompt">thanh@bkhn-ubuntu</span>:<span class="terminal-path">~/HDH/BTL</span>$ ';
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  clear() {
    this.isTyping = false;
    this.container.innerHTML = `<div>Chào mừng đến với EXT4 Terminal Inspector. Hãy chọn một Test Case bên trên để bắt đầu mô phỏng thời gian thực.</div><br>`;
    this.appendPrompt();
  }

  appendPrompt() {
    const promptLine = document.createElement('div');
    promptLine.className = 'term-line current-line';
    promptLine.innerHTML = `${this.promptPrefix}<span class="terminal-cursor"></span>`;
    this.container.appendChild(promptLine);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  typeCommand(cmdText, outputLines, onDone) {
    if (this.isTyping) return;
    this.isTyping = true;

    // Remove active cursor on old prompt
    const activeCursor = this.container.querySelector('.terminal-cursor');
    if (activeCursor) activeCursor.remove();

    const cmdLine = document.createElement('div');
    cmdLine.className = 'term-line';
    cmdLine.innerHTML = `${this.promptPrefix}<span class="typed-text"></span><span class="terminal-cursor"></span>`;
    this.container.appendChild(cmdLine);

    const typedSpan = cmdLine.querySelector('.typed-text');
    const cursor = cmdLine.querySelector('.terminal-cursor');
    let charIndex = 0;

    const typeChar = () => {
      if (charIndex < cmdText.length) {
        typedSpan.textContent += cmdText[charIndex];
        charIndex++;
        this.scrollToBottom();
        setTimeout(typeChar, Math.max(10, 35 / this.speedMultiplier));
      } else {
        cursor.remove();
        this.streamOutput(outputLines, onDone);
      }
    };

    typeChar();
  }

  streamOutput(outputLines, onDone) {
    let lineIdx = 0;
    const outputContainer = document.createElement('div');
    outputContainer.className = 'term-output-block';
    this.container.appendChild(outputContainer);

    const printNextLine = () => {
      if (lineIdx < outputLines.length) {
        const line = outputLines[lineIdx];
        const lineDiv = document.createElement('div');
        lineDiv.innerHTML = this.formatAnsiColor(line);
        outputContainer.appendChild(lineDiv);
        this.scrollToBottom();
        lineIdx++;
        setTimeout(printNextLine, Math.max(8, 25 / this.speedMultiplier));
      } else {
        this.isTyping = false;
        this.appendPrompt();
        if (onDone) onDone();
      }
    };

    setTimeout(printNextLine, 100 / this.speedMultiplier);
  }

  formatAnsiColor(text) {
    if (!text) return '&nbsp;';
    
    // Convert box drawing lines and colors to formatted html
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Header boxes
    if (out.includes('╔') || out.includes('╚') || out.includes('║') || out.includes('HỆ ĐIỀU HÀNH')) {
      return `<span style="color: #38bdf8; font-weight: bold;">${out}</span>`;
    }
    if (out.startsWith('>> Đang phân tích')) {
      return `<span style="color: #f59e0b; font-weight: bold;">${out}</span>`;
    }
    if (out.startsWith('[1]') || out.startsWith('[2]') || out.startsWith('[3]') || out.startsWith('[4]')) {
      return `<span style="color: #10b981; font-weight: bold; text-decoration: underline;">${out}</span>`;
    }
    if (out.includes('HOÀN HẢO')) {
      return `<span style="color: #34d399; font-weight: bold;">${out}</span>`;
    }
    if (out.includes('BỊ PHÂN MẢNH') || out.includes('LỖ HỔNG')) {
      return `<span style="color: #f87171; font-weight: bold;">${out}</span>`;
    }
    if (out.includes('UNWRITTEN')) {
      return `<span style="color: #60a5fa; font-weight: bold;">${out}</span>`;
    }
    if (out.includes('filefrag') || out.includes('debugfs')) {
      return `<span style="color: #a78bfa;">${out}</span>`;
    }

    return `<span style="color: #94a3b8;">${out}</span>`;
  }
}

window.TerminalMirror = TerminalMirror;
