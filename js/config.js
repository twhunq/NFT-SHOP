/**
 * ============================================
 *  NETFLIX PREMIUM – Configuration
 * ============================================
 */

const CONFIG = {
  // ── Supabase Database ───────────────────────
  SUPABASE: {
    URL: 'https://tcugrnqbptpbhmqldkyf.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdWdybnFicHRwYmhtcWxka3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTIzMDEsImV4cCI6MjA5MTQ2ODMwMX0.EjTgmZ19-M3195RfkO8aiL33Gee35WW1Y7ACuRc4IlE',
  },

  // Netflix Cookie API
  API_BASE: 'https://nft-netflix.onrender.com',
  ENDPOINTS: {
    GET_LINK: '/api/public/get-link',
    LIST: '/api/public/list',
    CHECK: '/api/public/check',
    TV_LOGIN: '/api/public/tv-login',
    MBBANK_CHECK: '/api/mbbank/check',
  },

  // Auto-check payment (MB Bank)
  AUTOCHECK: {
    POLL_INTERVAL_MS: 5000,          // Poll mỗi 5 giây
    MAX_POLL_ATTEMPTS: 180,          // Tối đa 180 lần = 15 phút
    FALLBACK_MANUAL_DELAY_MS: 60000, // Hiện nút xác nhận thủ công sau 60s
  },

  // MBBank Payment
  MBBANK: {
    BANK_ID: 'MB',
    ACCOUNT_NUMBER: '05331407888',   // ← Thay bằng STK thật
    ACCOUNT_NAME: 'TRAN TRUNG',     // ← Thay bằng tên thật
    TEMPLATE: 'compact2',
  },

  // Pricing
  PRICE: 20000,
  PRICE_FORMATTED: '20.000đ',
  DURATION_DAYS: 7,

  // Rate Limiting
  RATE_LIMIT: {
    MAX_REQUESTS: 5,
    WINDOW_MS: 60000,   // 1 minute
  },

  // Support
  SUPPORT: {
    MAX_REFRESH: 3,
    REFRESH_WINDOW_HOURS: 24,
  },

  // Admin
  ADMIN_USERNAME: 'binkyz2000',
  ADMIN_PASSWORD_HASH: 'b34af70db5a97bd02d1ca4e176de5b5c11fb959797b29f896a8b84d766991838',  // SHA-256 of Beat123@

  // Order
  ORDER_PREFIX: 'NFLX',
  PAYMENT_TIMEOUT_MS: 15 * 60 * 1000,  // 15 minutes

  // LocalStorage keys (chỉ lưu session)
  STORAGE_KEYS: {
    CURRENT_USER: 'nflx_current_user',
    RATE_LIMIT: 'nflx_rate_limit',
    ADMIN_AUTH: 'nflx_admin_auth',
  },

  // Pages
  PAGES: {
    HOME: 'home.html',
    HISTORY: 'history.html',
    SUPPORT: 'khieu-nai.html',
    ADMIN: 'admin.html',
  },
};
