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

  AUTH: {
    // Dùng cho Supabase Email OTP (magic link)
    REDIRECT_URI: window.location.origin + window.location.pathname,
  },

  // TMDB (phim trending miễn phí) – Lấy API key tại https://www.themoviedb.org/settings/api
  TMDB: {
    API_KEY: '3639cb361f041c34af71045cc18b4042', // Dán API key miễn phí của bạn vào đây
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

  // Giới hạn nhận mỗi ngày
  DAILY_CLAIM_LIMIT: 5,

  // Pricing (miễn phí)
  PRICE: 0,
  PRICE_FORMATTED: 'Miễn phí',
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
  ADMIN_USERNAME: 'binkyz2006@gmail.com',
  ADMIN_PASSWORD_HASH: 'b34af70db5a97bd02d1ca4e176de5b5c11fb959797b29f896a8b84d766991838',  // SHA-256 of Beat123@

  // Order
  ORDER_PREFIX: 'NFLX',

  // LocalStorage keys (chỉ lưu session)
  STORAGE_KEYS: {
    CURRENT_USER: 'nflx_current_user',
    AUTH_ACCESS_TOKEN: 'nflx_auth_access_token',
    AUTH_EMAIL: 'nflx_auth_email',
    RATE_LIMIT: 'nflx_rate_limit',
    ADMIN_AUTH: 'nflx_admin_auth',
    ADMIN_SETTINGS: 'nflx_admin_settings',
    DAILY_ACCESS_LOG: 'nflx_daily_access_log',
    ANNOUNCEMENT_HIDE_UNTIL: 'nflx_announcement_hide_until',
  },

  // Pages
  PAGES: {
    HOME: 'home.html',
    HISTORY: 'history.html',
    SUPPORT: 'khieu-nai.html',
    ADMIN: 'admin.html',
  },
};
