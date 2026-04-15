/**
 * ============================================
 *  NETFLIX PREMIUM – Payment (MBBank QR)
 *  Auto-check via MB Bank API
 * ============================================
 */

const Claim = {
  _isProcessing: false,  // Chống double-click
  _claimCodeResolver: null,
  _currentRequiredClaimCode: '',
  _previousBodyOverflow: '',

  _ensureClaimCodeModal() {
    let modal = document.getElementById('claim-code-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'claim-code-modal';
    modal.className = 'claim-code-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="claim-code-modal__overlay" data-action="overlay"></div>
      <div class="claim-code-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="claim-code-title">
        <div class="claim-code-modal__header">
          <div class="claim-code-modal__icon" aria-hidden="true">
            <span class="material-symbols-outlined">key</span>
          </div>
          <h3 class="claim-code-modal__title" id="claim-code-title">Nhập mã nhận</h3>
        </div>
        <p class="claim-code-modal__desc">Vui lòng nhập mã nhận để tiếp tục nhận gói của bạn.</p>
        <input id="claim-code-modal-input" class="claim-code-modal__input" type="text" maxlength="40" placeholder="VD: VIP2026" autocomplete="off" />
        <p id="claim-code-modal-error" class="claim-code-modal__error"></p>
        <div class="claim-code-modal__actions">
          <button type="button" class="claim-code-modal__btn claim-code-modal__btn--secondary" data-action="cancel">Hủy</button>
          <button type="button" class="claim-code-modal__btn claim-code-modal__btn--primary" data-action="submit">Xác nhận</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      const action = event.target?.dataset?.action;
      if (action === 'overlay' || action === 'cancel') {
        this._resolveClaimCode(null);
      }
      if (action === 'submit') {
        this._submitClaimCodeFromModal();
      }
    });

    modal.addEventListener('keydown', (event) => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        this._resolveClaimCode(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this._submitClaimCodeFromModal();
      }
    });

    const inputEl = modal.querySelector('#claim-code-modal-input');
    inputEl?.addEventListener('input', () => {
      inputEl.value = inputEl.value.toUpperCase();
      this._showClaimCodeError('');
    });
    inputEl?.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });

    return modal;
  },

  _showClaimCodeError(message) {
    const errorEl = document.getElementById('claim-code-modal-error');
    if (errorEl) errorEl.textContent = message || '';
  },

  _submitClaimCodeFromModal() {
    const input = document.getElementById('claim-code-modal-input');
    const value = (input?.value || '').trim().toUpperCase();
    if (!value) {
      this._showClaimCodeError('Vui lòng nhập mã nhận.');
      input?.focus();
      return;
    }
    if (this._currentRequiredClaimCode && value !== this._currentRequiredClaimCode) {
      this._showClaimCodeError('Mã nhận không đúng. Vui lòng thử lại.');
      input?.focus();
      input?.select();
      return;
    }
    if (input) input.value = value;
    this._showClaimCodeError('');
    this._resolveClaimCode(value);
  },

  _openClaimCodeModal(requiredClaimCode = '') {
    const modal = this._ensureClaimCodeModal();
    const input = document.getElementById('claim-code-modal-input');
    this._currentRequiredClaimCode = requiredClaimCode || '';
    this._showClaimCodeError('');

    if (input) input.value = '';
    modal.setAttribute('aria-hidden', 'false');
    this._previousBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('claim-code-modal--open'));

    setTimeout(() => {
      input?.focus();
      input?.select();
    }, 50);

    return new Promise((resolve) => {
      this._claimCodeResolver = resolve;
    });
  },

  _resolveClaimCode(value) {
    const modal = document.getElementById('claim-code-modal');
    if (modal) {
      modal.classList.remove('claim-code-modal--open');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = this._previousBodyOverflow;

    const resolver = this._claimCodeResolver;
    this._claimCodeResolver = null;
    this._currentRequiredClaimCode = '';
    if (resolver) {
      setTimeout(() => resolver(value), 300);
    }
  },

  // Removed generateQRUrl for free model

  // ── Create payment order + show modal ────
  async startClaim(type) {
    // Chống double-click tạo nhiều đơn
    if (this._isProcessing) return null;
    this._isProcessing = true;

    try {
      const requiredClaimCode = await DB.getClaimCode();
      if (requiredClaimCode) {
        const userCode = await this._openClaimCodeModal(requiredClaimCode);
        if (userCode === null) {
          throw new Error('Bạn đã hủy nhập mã nhận');
        }
      }

      const allowed = await DB.checkDailyLimit();
      if (!allowed) {
        throw new Error('Bạn đã nhận hết số lượt hôm nay. Vui lòng quay lại vào ngày mai!');
      }

      // Create order in DB (now async)
      const order = await DB.createOrder({ type, status: 'pending' });

      // Show payment modal with auto-check
      this._showClaimModal(order);

      return order;
    } finally {
      // Reset sau 2 giây để cho phép tạo đơn mới
      setTimeout(() => { this._isProcessing = false; }, 2000);
    }
  },

  // ── Render Payment Modal Content ─────────
  _showClaimModal(order) {
    const modal = document.getElementById('claim-modal');
    const content = document.getElementById('claim-modal-content');

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">download</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Đang xử lý tài khoản...</h3>
            <p class="text-xs text-on-surface-variant">${Utils.packageLabel(order.type)} • ${order.id}</p>
          </div>
        </div>
        <button onclick="Claim._cancelClaim('${order.id}')" class="text-on-surface-variant hover:text-on-surface transition-colors hidden">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-6 text-center">
        <div class="py-8">
            <div class="w-12 h-12 border-4 border-primary-container/20 border-t-primary-container rounded-full animate-spin mx-auto mb-4"></div>
            <p class="font-bold text-on-surface">Đang cấp tài khoản miễn phí</p>
            <p class="text-sm text-on-surface-variant">Vui lòng chờ trong giây lát...</p>
        </div>
      </div>
    `;

    Utils.showModal('claim-modal');

    // Automatically trigger confirmation delivery
    setTimeout(() => {
      Claim.confirmClaim(order.id);
    }, 1500);
  },

  // ── Cancel request and close modal ──────
  _cancelClaim(orderId) {
    Utils.hideModal('claim-modal');
  },

  // ── Confirm Delivery (free model skip MBBank) ───
  async confirmClaim(orderId) {
    try {
      const order = await DB.getOrder(orderId);
      if (!order) throw new Error('Không tìm thấy đơn hàng');

      await DB.updateOrder(orderId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

      if (order.type === 'mobile') {
        await this._deliverMobileLink(orderId);
      } else {
        await this._deliverTVSetup(orderId);
      }
    } catch (err) {
      Utils.hideModal('claim-modal');
      Utils.toast(err.message, 'error');
    }
  },

  // ── Deliver Mobile/PC Link ───────────────
  async _deliverMobileLink(orderId) {
    try {
      const data = await API.getLink();

      if (data.status === 'SUCCESS') {
        // Dừng timer trước khi cập nhật để tránh race condition
        Utils.stopCountdown();

        await DB.updateOrder(orderId, {
          status: 'completed',
          loginLink: data.login_link,
          nftoken: data.nftoken,
          cookieId: data.account?.email || '',
          accountInfo: data.account,
          completedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + CONFIG.DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        });

        this._showSuccessMobile(orderId, data);
      } else {
        throw new Error(data.error || 'Không lấy được link. Thử lại sau!');
      }
    } catch (err) {
      await DB.updateOrder(orderId, { status: 'failed' });
      Utils.hideModal('claim-modal');
      Utils.toast('Lỗi: ' + err.message, 'error', 6000);
    }
  },

  // ── Deliver TV Setup ─────────────────────
  async _deliverTVSetup(orderId) {
    try {
      // First, get a cookie/account for this order
      const data = await API.getLink();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.error || 'Không có tài khoản khả dụng');
      }

      // Find the cookie ID from the list
      const list = await API.getList();
      const matchedCookie = list.find(c => c.login_link === data.login_link || c.nftoken === data.nftoken);

      await DB.updateOrder(orderId, {
        status: 'paid',
        cookieId: matchedCookie?.id || '',
        accountInfo: data.account,
        loginLink: data.login_link,
        nftoken: data.nftoken,
      });

      this._showTVCodeInput(orderId, data);
    } catch (err) {
      await DB.updateOrder(orderId, { status: 'failed' });
      Utils.hideModal('claim-modal');
      Utils.toast('Lỗi: ' + err.message, 'error', 6000);
    }
  },

  // ── Show Success: Mobile/PC ──────────────
  async _showSuccessMobile(orderId, data) {
    const content = document.getElementById('claim-modal-content');
    const order = await DB.getOrder(orderId);

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-green-400">check_circle</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Thành công!</h3>
            <p class="text-xs text-on-surface-variant">${order.id} • Gói Mobile/PC</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('claim-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-6">
        <!-- Success Animation -->
        <div class="text-center py-4">
          <div class="success-checkmark mx-auto mb-4">
            <div class="check-icon">
              <span class="icon-line line-tip"></span>
              <span class="icon-line line-long"></span>
              <div class="icon-circle"></div>
              <div class="icon-fix"></div>
            </div>
          </div>
          <p class="text-on-surface-variant text-sm">Link đăng nhập Netflix của bạn đã sẵn sàng</p>
        </div>

        <!-- Account Info -->
        <div class="bg-surface-container rounded-xl p-4 space-y-2">
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Email</span><span class="font-bold">${data.account?.email || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Gói cước</span><span class="font-bold">${data.account?.plan || 'Premium'}</span></div>
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Quốc gia</span><span class="font-bold">${data.account?.country || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Hết hạn</span><span class="font-bold text-primary">${Utils.formatDate(new Date(Date.now() + CONFIG.DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString())}</span></div>
        </div>

        <!-- Login Link -->
        <div class="bg-surface-container-highest rounded-xl p-4">
          <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Link đăng nhập</label>
          <div class="flex items-center gap-2 bg-black/30 rounded-lg p-3">
            <code class="text-primary font-mono text-xs flex-1 truncate" id="login-link-display">${data.login_link}</code>
            <button onclick="Utils.copyToClipboard('${data.login_link}')" class="shrink-0 text-on-surface-variant hover:text-primary-container transition-colors">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-3">
          <a href="huong-dan.html" target="_blank" rel="noopener" 
            class="py-3 bg-primary-container text-on-primary-container rounded-lg font-bold text-sm text-center flex items-center justify-center gap-2 hover:opacity-90 transition-all">
            <span class="material-symbols-outlined text-base">help</span>
            Hướng dẫn
          </a>
          <button onclick="Utils.copyToClipboard('${data.login_link}')"
            class="py-3 bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-bright transition-all">
            <span class="material-symbols-outlined text-base">content_copy</span>
            Sao chép link
          </button>
        </div>

        <!-- Note -->
        <div class="bg-tertiary-container/10 border border-tertiary/10 rounded-lg p-3 flex items-start gap-2">
          <span class="material-symbols-outlined text-tertiary text-sm mt-0.5">info</span>
          <p class="text-xs text-tertiary/80">Link sẽ được lưu trong <strong>Lịch sử nhận tài khoản</strong>. Nếu link hết hạn, vui lòng truy cập Trang chủ để nhận lại hoàn toàn miễn phí.</p>
        </div>
      </div>
    `;
  },

  // ── Show TV Code Input ───────────────────
  async _showTVCodeInput(orderId, data) {
    const content = document.getElementById('claim-modal-content');
    const order = await DB.getOrder(orderId);

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-tertiary">tv</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Đăng nhập TV</h3>
            <p class="text-xs text-on-surface-variant">${order.id} • Gói TV</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('claim-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-6">
        <!-- Instructions -->
        <div class="bg-surface-container rounded-xl p-5 space-y-4">
          <h4 class="font-bold text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary-container">menu_book</span>
            Hướng dẫn đăng nhập TV
          </h4>
          <ol class="space-y-3 text-sm text-on-surface-variant">
            <li class="flex items-start gap-3">
              <span class="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary-container">1</span>
              <span>Mở ứng dụng <strong class="text-on-surface">Netflix</strong> trên Smart TV của bạn</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary-container">2</span>
              <span>Chọn <strong class="text-on-surface">"Đăng nhập"</strong> → <strong class="text-on-surface">"Dùng mã đăng nhập"</strong></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary-container">3</span>
              <span>TV sẽ hiển thị <strong class="text-on-surface">mã 8 ký tự</strong> — nhập mã đó vào ô bên dưới</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary-container">4</span>
              <span>Nhấn <strong class="text-on-surface">"Xác nhận"</strong> và chờ TV tự động đăng nhập</span>
            </li>
          </ol>
        </div>

        <!-- TV Code Input -->
        <div>
          <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">Nhập mã hiển thị trên TV</label>
          <input type="text" id="tv-code-input" maxlength="8" 
            placeholder="VD: ABCD1234"
            class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface text-center text-3xl font-mono font-bold py-4 rounded-xl transition-all tracking-[0.5em] uppercase placeholder:text-zinc-600 placeholder:tracking-normal placeholder:text-lg"
            oninput="this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '')"
          />
        </div>

        <!-- Submit Button -->
        <button id="btn-tv-login"
          onclick="Claim.submitTVCode('${orderId}')"
          class="w-full py-4 bg-primary-container text-on-primary-container rounded-lg font-black text-lg active:scale-[0.98] transition-all shadow-xl shadow-primary-container/20 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">tv</span>
          <span>Đăng nhập vào TV</span>
        </button>

        <!-- Account Info -->
        <div class="bg-surface-container/50 rounded-lg p-3 flex items-center gap-3">
          <span class="material-symbols-outlined text-green-400 text-sm">check_circle</span>
          <p class="text-xs text-on-surface-variant">Tài khoản <strong class="text-on-surface">${data.account?.email || ''}</strong> • ${data.account?.plan || 'Premium'} • ${data.account?.country || ''}</p>
        </div>
      </div>
    `;
  },

  // ── Submit TV Code ───────────────────────
  async submitTVCode(orderId) {
    const btn = document.getElementById('btn-tv-login');
    const input = document.getElementById('tv-code-input');
    const tvCode = input?.value?.trim();

    if (!tvCode || tvCode.length < 4) {
      Utils.toast('Vui lòng nhập mã TV hợp lệ (tối thiểu 4 ký tự)', 'warning');
      return;
    }

    Utils.setLoading(btn, true);

    try {
      const order = await DB.getOrder(orderId);
      if (!order) throw new Error('Không tìm thấy đơn hàng');

      if (!order.cookieId) {
        throw new Error('Không tìm thấy tài khoản Netflix liên kết');
      }

      const result = await API.tvLogin(order.cookieId, tvCode);

      if (result.status === 'SUCCESS') {
        // Dừng timer trước khi cập nhật để tránh race condition
        Utils.stopCountdown();

        await DB.updateOrder(orderId, {
          status: 'completed',
          tvCode: tvCode,
          tvLoginStatus: 'success',
          completedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + CONFIG.DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        });

        this._showSuccessTV(orderId, result);
      } else {
        throw new Error(result.error || result.message || 'Mã TV không hợp lệ hoặc đã hết hạn');
      }
    } catch (err) {
      Utils.setLoading(btn, false);
      Utils.toast(err.message, 'error', 5000);
    }
  },

  // ── Show Success: TV ─────────────────────
  async _showSuccessTV(orderId, result) {
    const content = document.getElementById('claim-modal-content');
    const order = await DB.getOrder(orderId);

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-green-400">check_circle</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Đăng nhập TV thành công!</h3>
            <p class="text-xs text-on-surface-variant">${order.id}</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('claim-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-6">
        <div class="text-center py-6">
          <div class="success-checkmark mx-auto mb-4">
            <div class="check-icon">
              <span class="icon-line line-tip"></span>
              <span class="icon-line line-long"></span>
              <div class="icon-circle"></div>
              <div class="icon-fix"></div>
            </div>
          </div>
          <h4 class="text-2xl font-black font-headline text-green-400 mb-2">Hoàn tất!</h4>
          <p class="text-on-surface-variant">TV của bạn đã được đăng nhập Netflix thành công. Hãy quay lại TV và thưởng thức!</p>
        </div>

        <div class="bg-surface-container rounded-xl p-4 space-y-2">
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Mã TV đã dùng</span><span class="font-bold font-mono">${order.tvCode}</span></div>
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Hạn sử dụng</span><span class="font-bold text-primary">${CONFIG.DURATION_DAYS} ngày</span></div>
        </div>

        <div class="bg-tertiary-container/10 border border-tertiary/10 rounded-lg p-3 flex items-start gap-2">
          <span class="material-symbols-outlined text-tertiary text-sm mt-0.5">info</span>
          <p class="text-xs text-tertiary/80">Nếu TV bị đăng xuất, vui lòng truy cập Trang chủ để nhận lại mã hoàn toàn miễn phí.</p>
        </div>

        <button onclick="Utils.hideModal('claim-modal')"
          class="w-full py-3 bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm hover:bg-surface-bright transition-all">
          Đóng
        </button>
      </div>
    `;
  },
};
