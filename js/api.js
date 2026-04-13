/**
 * ============================================
 *  NETFLIX PREMIUM – API Wrapper
 * ============================================
 */

const API = {
  // ── Rate limiter state ───────────────────
  _requestLog: [],

  _checkRateLimit() {
    const now = Date.now();
    this._requestLog = this._requestLog.filter(t => now - t < CONFIG.RATE_LIMIT.WINDOW_MS);
    if (this._requestLog.length >= CONFIG.RATE_LIMIT.MAX_REQUESTS) {
      const waitTime = Math.ceil((CONFIG.RATE_LIMIT.WINDOW_MS - (now - this._requestLog[0])) / 1000);
      throw new Error(`Quá nhiều request. Vui lòng đợi ${waitTime} giây`);
    }
    this._requestLog.push(now);
  },

  // ── Base fetch with timeout ──────────────
  async _fetch(endpoint, options = {}) {
    this._checkRateLimit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout (30s). Server có thể đang khởi động, hãy thử lại.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  },

  // ── Retry wrapper ────────────────────────
  async _retry(fn, maxRetries = 2) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < maxRetries && !err.message.includes('Quá nhiều request')) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));  // exponential backoff
        }
      }
    }
    throw lastError;
  },

  // ── GET Netflix Login Link (Auto) ────────
  async getLink() {
    return this._retry(() => this._fetch(CONFIG.ENDPOINTS.GET_LINK));
  },

  // ── GET Cookie List ──────────────────────
  async getList() {
    return this._fetch(CONFIG.ENDPOINTS.LIST);
  },

  // ── POST Check Cookie Status ─────────────
  async checkCookie(cookieId) {
    return this._retry(() => this._fetch(CONFIG.ENDPOINTS.CHECK, {
      method: 'POST',
      body: JSON.stringify({ id: cookieId }),
    }));
  },

  // ── POST TV Login ────────────────────────
  async tvLogin(cookieId, tvCode) {
    return this._fetch(CONFIG.ENDPOINTS.TV_LOGIN, {
      method: 'POST',
      body: JSON.stringify({ id: cookieId, tv_code: tvCode }),
    });
  },
};
