/**
 * ============================================
 *  NETFLIX PREMIUM – Auto Payment Check
 *  (MB Bank Transaction Matching)
 * ============================================
 *  Adapted from payments/api/mbbank/check/route.ts
 *  Polls server endpoint to detect bank transfers
 */

const AutoCheck = {
  // ── State ─────────────────────────────────
  _pollTimer: null,
  _pollCount: 0,
  _abortController: null,
  _currentOrder: null,
  _onDetected: null,    // callback(order, result)
  _onTimeout: null,     // callback(order)
  _onError: null,       // callback(error)
  _isProcessing: false, // Race condition guard

  // ── Start polling for a specific order ────
  startPolling(order, { onDetected, onTimeout, onError } = {}) {
    this.stopPolling();

    this._currentOrder = order;
    this._pollCount = 0;
    this._isProcessing = false;
    this._onDetected = onDetected || null;
    this._onTimeout = onTimeout || null;
    this._onError = onError || null;
    this._abortController = new AbortController();


    // Initial check after 3 seconds (give time for QR to display)
    setTimeout(() => {
      if (this._currentOrder?.id === order.id) {
        this._doCheck();
      }
    }, 3000);

    // Then poll at regular interval
    this._pollTimer = setInterval(() => {
      this._doCheck();
    }, CONFIG.AUTOCHECK.POLL_INTERVAL_MS);
  },

  // ── Single check cycle ────────────────────
  async _doCheck() {
    if (!this._currentOrder) return;
    if (this._isProcessing) return; // Prevent concurrent checks

    this._pollCount++;

    // Check max attempts
    if (this._pollCount > CONFIG.AUTOCHECK.MAX_POLL_ATTEMPTS) {
      this.stopPolling();
      if (this._onTimeout) {
        this._onTimeout(this._currentOrder);
      }
      return;
    }

    try {
      const result = await this._checkPayment(this._currentOrder);

      if (result.paid) {
        // Payment detected!
        this._isProcessing = true;

        // Save references BEFORE stopPolling() which nulls _currentOrder
        const detectedOrder = this._currentOrder;
        const detectedCallback = this._onDetected;

        this.stopPolling();

        if (detectedCallback && detectedOrder) {
          detectedCallback(detectedOrder, result);
        }
      }
    } catch (err) {
      // Don't stop on individual errors — just log and continue
      if (err.name === 'AbortError') return; // Expected when stopping

      if (this._onError) {
        this._onError(err);
      }
    }
  },

  // ── Call server to check MB Bank transactions ──
  async _checkPayment(order) {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.MBBANK_CHECK}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceCode: order.paymentRef,
        amount: order.amount,
        content: order.paymentRef,
      }),
      signal: this._abortController?.signal,
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    return await res.json();
  },

  // ── Stop polling ──────────────────────────
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._currentOrder = null;
    this._pollCount = 0;
    this._isProcessing = false;
  },

  // ── Status helpers ────────────────────────
  isPolling() {
    return this._pollTimer !== null;
  },

  getPollCount() {
    return this._pollCount;
  },

  getElapsedSeconds() {
    return this._pollCount * (CONFIG.AUTOCHECK.POLL_INTERVAL_MS / 1000);
  },
};
