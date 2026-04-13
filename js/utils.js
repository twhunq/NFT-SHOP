/**
 * ============================================
 *  NETFLIX PREMIUM – Utilities
 * ============================================
 */

const Utils = {
  // ── Toast Notifications ──────────────────
  toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container') || this._createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };

    toast.innerHTML = `
      <span class="material-symbols-outlined toast-icon">${icons[type] || 'info'}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  _createToastContainer() {
    const c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
    return c;
  },

  // ── Copy to Clipboard ────────────────────
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Đã sao chép!', 'success', 2000);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.toast('Đã sao chép!', 'success', 2000);
      return true;
    }
  },

  // ── Format Currency ──────────────────────
  formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  },

  // ── Format Date ──────────────────────────
  formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  // ── Format Relative Time ─────────────────
  formatRelative(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  },

  // ── Status Badge HTML ────────────────────
  statusBadge(status) {
    const map = {
      pending: { color: 'yellow', text: 'Chờ thanh toán', icon: 'schedule' },
      paid: { color: 'blue', text: 'Đã thanh toán', icon: 'payments' },
      completed: { color: 'green', text: 'Thành công', icon: 'check_circle' },
      failed: { color: 'red', text: 'Thất bại', icon: 'cancel' },
    };
    const s = map[status] || map.pending;
    return `<span class="status-badge status-${s.color}">
      <span class="status-dot"></span>${s.text}
    </span>`;
  },

  // ── Package Type Label ───────────────────
  packageLabel(type) {
    return type === 'tv' ? '📺 Gói TV' : '📱 Gói Mobile/PC';
  },

  // ── Simple Math CAPTCHA ──────────────────
  generateCaptcha() {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    return { question: `${a} + ${b} = ?`, answer: a + b };
  },

  // ── Modal Management ─────────────────────
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
      // Animate in
      requestAnimationFrame(() => {
        modal.querySelector('.modal-content')?.classList.add('modal-enter');
      });
    }
  },

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.querySelector('.modal-content')?.classList.remove('modal-enter');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
      }, 200);
    }
  },

  // ── Loading State ────────────────────────
  setLoading(element, loading, originalText = '') {
    if (!element) return;
    if (loading) {
      element.dataset.originalText = element.innerHTML;
      element.innerHTML = `<div class="spinner-sm"></div><span>Đang xử lý...</span>`;
      element.disabled = true;
      element.classList.add('opacity-70', 'pointer-events-none');
    } else {
      element.innerHTML = originalText || element.dataset.originalText || '';
      element.disabled = false;
      element.classList.remove('opacity-70', 'pointer-events-none');
    }
  },

  // ── Escape HTML ──────────────────────────
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ── Validate email ───────────────────────
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // ── Countdown Timer ──────────────────────
  startCountdown(elementId, endTime, onExpire) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        el.textContent = '00:00';
        if (onExpire) onExpire();
        return;
      }
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
      requestAnimationFrame(tick);
    };
    tick();
  },
};
