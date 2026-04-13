/**
 * ============================================
 *  NETFLIX PREMIUM – Payment (MBBank QR)
 *  Auto-check via MB Bank API
 * ============================================
 */

const Payment = {
  // ── Generate VietQR URL ──────────────────
  generateQRUrl(amount, reference) {
    const { BANK_ID, ACCOUNT_NUMBER, TEMPLATE } = CONFIG.MBBANK;
    const desc = encodeURIComponent(reference);
    return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NUMBER}-${TEMPLATE}.png?amount=${amount}&addInfo=${desc}&accountName=${encodeURIComponent(CONFIG.MBBANK.ACCOUNT_NAME)}`;
  },

  // ── Create payment order + show modal ────
  async startPayment(type) {
    // Create order in DB (now async)
    const order = await DB.createOrder({ type, status: 'pending' });

    // Show payment modal with auto-check
    this._showPaymentModal(order);

    return order;
  },

  // ── Render Payment Modal Content ─────────
  _showPaymentModal(order) {
    const qrUrl = this.generateQRUrl(order.amount, order.paymentRef);
    const expiresAt = Date.now() + CONFIG.PAYMENT_TIMEOUT_MS;

    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-modal-content');

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">payments</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Thanh toán đơn hàng</h3>
            <p class="text-xs text-on-surface-variant">${Utils.packageLabel(order.type)} • ${order.id}</p>
          </div>
        </div>
        <button onclick="Payment._cancelPayment('${order.id}')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-6">
        <!-- QR Code -->
        <div class="flex justify-center">
          <div class="inline-block bg-white rounded-2xl shadow-2xl p-2 pb-0 mb-2">
            <div class="w-[240px] aspect-square overflow-hidden relative bg-white rounded-xl">
              <img src="${qrUrl}" alt="QR Code" class="w-full h-auto absolute top-0 left-0" id="qr-image" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22224%22 height=%22224%22><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 font-size=%2214%22>QR Error</text></svg>'"/>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div class="bg-surface-container rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant">Ngân hàng</span>
            <span class="font-bold text-on-surface">MBBank</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant">Số tài khoản</span>
            <div class="flex items-center gap-2">
              <span class="font-bold font-mono text-on-surface">${CONFIG.MBBANK.ACCOUNT_NUMBER}</span>
              <button onclick="Utils.copyToClipboard('${CONFIG.MBBANK.ACCOUNT_NUMBER}')" class="text-primary-container hover:opacity-80">
                <span class="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant">Chủ tài khoản</span>
            <span class="font-bold text-on-surface">${CONFIG.MBBANK.ACCOUNT_NAME}</span>
          </div>
          <div class="border-t border-outline-variant/10 pt-3 flex justify-between items-center">
            <span class="text-sm text-on-surface-variant">Số tiền</span>
            <span class="text-2xl font-black text-primary font-headline">${Utils.formatVND(order.amount)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant">Nội dung CK</span>
            <div class="flex items-center gap-2">
              <code class="text-primary-container font-bold bg-primary-container/10 px-2 py-1 rounded">${order.paymentRef}</code>
              <button onclick="Utils.copyToClipboard('${order.paymentRef}')" class="text-primary-container hover:opacity-80">
                <span class="material-symbols-outlined text-sm">content_copy</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Auto-Check Status -->
        <div id="autocheck-status" class="autocheck-status autocheck-waiting">
          <div class="autocheck-icon">
            <div class="autocheck-spinner"></div>
          </div>
          <div class="autocheck-text">
            <p class="autocheck-title">Đang chờ thanh toán...</p>
            <p class="autocheck-subtitle">Hệ thống tự động kiểm tra mỗi 5 giây</p>
          </div>
        </div>

        <!-- Timer -->
        <div class="text-center">
          <p class="text-xs text-on-surface-variant mb-1">Đơn hàng hết hạn sau</p>
          <span id="payment-timer" class="text-2xl font-mono font-bold text-primary"></span>
        </div>

        <!-- Warning -->
        <div class="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
          <span class="material-symbols-outlined text-yellow-400 text-sm mt-0.5">warning</span>
          <p class="text-xs text-yellow-200/80">Vui lòng chuyển <strong>đúng số tiền</strong> và <strong>đúng nội dung</strong> để hệ thống xác nhận tự động.</p>
        </div>

        <!-- Manual Fallback Button (hidden initially, shown after 60s) -->
        <div id="manual-confirm-area" class="hidden">
          <div class="border-t border-outline-variant/10 pt-4">
            <p class="text-xs text-on-surface-variant text-center mb-3">Nếu hệ thống chưa phát hiện, bạn có thể xác nhận thủ công:</p>
            <button id="btn-confirm-payment" 
              onclick="Payment.confirmPayment('${order.id}')"
              class="w-full py-3 bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-bright transition-all">
              <span class="material-symbols-outlined text-base">verified</span>
              <span>Tôi đã thanh toán xong</span>
            </button>
          </div>
        </div>
      </div>
    `;

    Utils.showModal('payment-modal');

    // Start countdown
    Utils.startCountdown('payment-timer', expiresAt, async () => {
      AutoCheck.stopPolling();
      await DB.updateOrder(order.id, { status: 'failed' });
      Utils.hideModal('payment-modal');
      Utils.toast('Đơn hàng đã hết hạn thanh toán', 'error');
    });

    // Start auto-check polling
    AutoCheck.startPolling(order, {
      onDetected: (order, result) => {
        this._onPaymentDetected(order, result);
      },
      onTimeout: (order) => {
        // Show manual button if auto-check times out
        this._showManualFallback();
        Utils.toast('Hết thời gian tự động kiểm tra. Hãy xác nhận thủ công.', 'warning');
      },
      onError: (err) => {
        // Update status text on repeated errors
        const subtitle = document.querySelector('.autocheck-subtitle');
        if (subtitle && AutoCheck.getPollCount() > 5) {
          subtitle.textContent = 'Đang thử lại kết nối...';
        }
      },
    });

    // Show manual fallback button after configured delay
    setTimeout(() => {
      this._showManualFallback();
    }, CONFIG.AUTOCHECK.FALLBACK_MANUAL_DELAY_MS);
  },

  // ── Show manual fallback button ─────────
  _showManualFallback() {
    const area = document.getElementById('manual-confirm-area');
    if (area) {
      area.classList.remove('hidden');
    }
  },

  // ── Cancel payment and close modal ──────
  _cancelPayment(orderId) {
    AutoCheck.stopPolling();
    Utils.hideModal('payment-modal');
  },

  // ── Auto-detected payment callback ──────
  async _onPaymentDetected(order, result) {
    // Update auto-check status to success
    const statusEl = document.getElementById('autocheck-status');
    if (statusEl) {
      statusEl.className = 'autocheck-status autocheck-success';
      statusEl.innerHTML = `
        <div class="autocheck-icon">
          <span class="material-symbols-outlined text-green-400 text-2xl">check_circle</span>
        </div>
        <div class="autocheck-text">
          <p class="autocheck-title text-green-400">Đã nhận thanh toán!</p>
          <p class="autocheck-subtitle">Đang chuẩn bị tài khoản Netflix...</p>
        </div>
      `;
    }

    // Hide manual button
    const manualArea = document.getElementById('manual-confirm-area');
    if (manualArea) manualArea.classList.add('hidden');

    // Mark as paid
    await DB.updateOrder(order.id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      transactionId: result.transactionId || '',
      transactionDate: result.transactionDate || '',
    });

    // Small delay for UX (show success animation)
    await new Promise(r => setTimeout(r, 1500));

    // Deliver based on type
    if (order.type === 'mobile') {
      await this._deliverMobileLink(order.id);
    } else {
      await this._deliverTVSetup(order.id);
    }
  },

  // ── Confirm Payment (manual fallback) ───
  async confirmPayment(orderId) {
    const btn = document.getElementById('btn-confirm-payment');
    Utils.setLoading(btn, true);

    // Stop auto-check since user is confirming manually
    AutoCheck.stopPolling();

    try {
      const order = await DB.getOrder(orderId);
      if (!order) throw new Error('Không tìm thấy đơn hàng');

      // ── Verify payment via MB Bank API before delivering ──
      const verifyRes = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MBBANK_CHECK}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceCode: order.paymentRef,
          amount: order.amount,
          content: order.paymentRef,
        }),
      });

      if (verifyRes.ok) {
        const result = await verifyRes.json();
        if (!result.paid) {
          throw new Error('Hệ thống chưa tìm thấy giao dịch. Vui lòng đợi 1-2 phút sau khi chuyển khoản rồi thử lại.');
        }
        // Payment verified — proceed
        await DB.updateOrder(orderId, {
          status: 'paid',
          paidAt: new Date().toISOString(),
          transactionId: result.transactionId || '',
          transactionDate: result.transactionDate || '',
        });
      } else {
        throw new Error('Không thể xác minh thanh toán. Vui lòng thử lại sau.');
      }

      if (order.type === 'mobile') {
        await this._deliverMobileLink(orderId);
      } else {
        await this._deliverTVSetup(orderId);
      }
    } catch (err) {
      Utils.setLoading(btn, false);
      Utils.toast(err.message, 'error');
    }
  },

  // ── Deliver Mobile/PC Link ───────────────
  async _deliverMobileLink(orderId) {
    try {
      const data = await API.getLink();

      if (data.status === 'SUCCESS') {
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
      Utils.hideModal('payment-modal');
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
      Utils.hideModal('payment-modal');
      Utils.toast('Lỗi: ' + err.message, 'error', 6000);
    }
  },

  // ── Show Success: Mobile/PC ──────────────
  async _showSuccessMobile(orderId, data) {
    const content = document.getElementById('payment-modal-content');
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
        <button onclick="Utils.hideModal('payment-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
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
          <div class="flex justify-between"><span class="text-sm text-on-surface-variant">Hạn sử dụng</span><span class="font-bold text-primary">${CONFIG.DURATION_DAYS} ngày</span></div>
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
          <a href="${data.login_link}" target="_blank" rel="noopener" 
            class="py-3 bg-primary-container text-on-primary-container rounded-lg font-bold text-sm text-center flex items-center justify-center gap-2 hover:opacity-90 transition-all">
            <span class="material-symbols-outlined text-base">open_in_new</span>
            Mở Netflix
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
          <p class="text-xs text-tertiary/80">Link sẽ được lưu trong <strong>Lịch sử đơn hàng</strong>. Nếu link hết hạn, vào trang <strong>Khiếu nại</strong> để nhận link mới.</p>
        </div>
      </div>
    `;
  },

  // ── Show TV Code Input ───────────────────
  async _showTVCodeInput(orderId, data) {
    const content = document.getElementById('payment-modal-content');
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
        <button onclick="Utils.hideModal('payment-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
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
          onclick="Payment.submitTVCode('${orderId}')"
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
    const content = document.getElementById('payment-modal-content');
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
        <button onclick="Utils.hideModal('payment-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
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
          <p class="text-xs text-tertiary/80">Nếu TV bị đăng xuất, vào trang <strong>Khiếu nại</strong> và nhập mã đơn hàng <strong>${order.id}</strong> để đăng nhập lại (tối đa 3 lần/24h).</p>
        </div>

        <button onclick="Utils.hideModal('payment-modal')"
          class="w-full py-3 bg-surface-container-highest text-on-surface rounded-lg font-bold text-sm hover:bg-surface-bright transition-all">
          Đóng
        </button>
      </div>
    `;
  },
};
