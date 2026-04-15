/**
 * ============================================
 *  NETFLIX PREMIUM – Announcement Popup
 * ============================================
 */

const Announcement = {
  _modalId: 'announcement-modal',

  _isSuppressed24h() {
    const hideUntil = Number(localStorage.getItem(CONFIG.STORAGE_KEYS.ANNOUNCEMENT_HIDE_UNTIL) || 0);
    return hideUntil > Date.now();
  },

  _suppress24h() {
    const hideUntil = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem(CONFIG.STORAGE_KEYS.ANNOUNCEMENT_HIDE_UNTIL, String(hideUntil));
  },

  _ensureModal() {
    let modal = document.getElementById(this._modalId);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = this._modalId;
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
      <div class="modal-content" id="announcement-modal-content"></div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) {
        this.closeNow();
      }
    });

    return modal;
  },

  _renderContent(content) {
    const box = document.getElementById('announcement-modal-content');
    if (!box) return;

    const safeHtml = Utils.escapeHtml(content).replace(/\n/g, '<br/>');
    box.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">campaign</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Thông báo</h3>
            <p class="text-xs text-on-surface-variant">Tin nhắn từ quản trị viên</p>
          </div>
        </div>
        <button onclick="Announcement.closeNow()" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body space-y-5">
        <div class="bg-surface-container rounded-xl p-4 text-sm text-on-surface-variant leading-relaxed">
          ${safeHtml}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onclick="Announcement.closeNow()"
            class="py-3 bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm hover:bg-surface-bright transition-all">
            Tắt
          </button>
          <button onclick="Announcement.snooze24h()"
            class="py-3 bg-primary-container text-on-primary-container rounded-lg font-bold text-sm hover:opacity-90 transition-all">
            Tắt trong 24h
          </button>
        </div>
      </div>
    `;
  },

  closeNow() {
    Utils.hideModal(this._modalId);
  },

  snooze24h() {
    this._suppress24h();
    Utils.hideModal(this._modalId);
  },

  async init() {
    // Không hiển thị popup trên trang admin
    if (location.pathname.toLowerCase().includes('admin.html')) return;
    if (this._isSuppressed24h()) return;

    try {
      const settings = await DB.getAnnouncementSettings();
      if (!settings.enabled || !settings.content) return;

      this._ensureModal();
      this._renderContent(settings.content);
      Utils.showModal(this._modalId);
    } catch (err) {
      console.error('[Announcement] init ERROR:', err);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Announcement.init();
});
