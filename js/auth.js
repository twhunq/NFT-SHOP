/**
 * ============================================
 *  NETFLIX PREMIUM - Authentication
 *  Password login/register + email verification
 * ============================================
 */

const Auth = {
  _cachedUser: null,
  _activeTab: 'login',
  _registerNoticeTimer: null,

  async _hash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  _normalizeEmail(input) {
    return (input || '').trim().toLowerCase();
  },

  _validateEmail(input) {
    const email = this._normalizeEmail(input);
    if (!email) return { ok: false, error: 'Vui lòng nhập email Gmail' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Email không hợp lệ' };
    }

    const [localPart = '', domainPart = ''] = email.split('@');
    if (domainPart.endsWith('.gmail.com')) {
      console.warn('[Auth] Blocked Gmail subdomain email:', email);
      return { ok: false, error: 'Email thuộc subdomain của Gmail không được phép đăng ký.' };
    }

    if (domainPart !== 'gmail.com') {
      return { ok: false, error: 'Chỉ cho phép đăng ký bằng địa chỉ @gmail.com' };
    }

    // Gmail "thuần": chỉ cho phép chữ và số trước @gmail.com
    if (!/^[a-z0-9]+$/.test(localPart)) {
      console.warn('[Auth] Blocked non-pure Gmail local-part:', email);
      return { ok: false, error: 'Email thuộc subdomain của Gmail không được phép đăng ký.' };
    }

    return { ok: true, email };
  },

  _checkPasswordStrength(password) {
    const value = String(password || '');
    const checks = {
      length: value.length >= 8,
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-z0-9]/.test(value),
    };

    const score = Object.values(checks).filter(Boolean).length;
    let label = 'Yếu';
    if (score >= 5) label = 'Mạnh';
    else if (score >= 4) label = 'Khá';
    else if (score >= 3) label = 'Trung bình';

    const missing = [];
    if (!checks.length) missing.push('tối thiểu 8 ký tự');
    if (!checks.lower) missing.push('chữ thường');
    if (!checks.upper) missing.push('chữ hoa');
    if (!checks.number) missing.push('số');
    if (!checks.special) missing.push('ký tự đặc biệt');

    return {
      ok: checks.length && checks.lower && checks.upper && checks.number && checks.special,
      score,
      label,
      missing,
    };
  },

  _validateRegistrationInput(emailInput, password, confirmPassword) {
    const emailValidation = this._validateEmail(emailInput);
    if (!emailValidation.ok) return emailValidation;

    const passwordStrength = this._checkPasswordStrength(password);
    if (!passwordStrength.ok) {
      return {
        ok: false,
        error: `Mật khẩu chưa đủ mạnh (${passwordStrength.label}). Cần bổ sung: ${passwordStrength.missing.join(', ')}`,
      };
    }

    if (password !== confirmPassword) {
      return { ok: false, error: 'Nhập lại mật khẩu không khớp' };
    }

    return { ok: true, email: emailValidation.email };
  },

  _normalizeUsernameFromEmail(email, fallbackUsername = null) {
    if (fallbackUsername) return fallbackUsername;
    return this._normalizeEmail(email) || null;
  },

  async _ensureUserByEmailProfile(profile) {
    const email = this._normalizeEmail(profile?.email);
    if (!email) throw new Error('Không lấy được email từ phiên đăng nhập');
    const emailValidation = this._validateEmail(email);
    if (!emailValidation.ok) {
      throw new Error(emailValidation.error);
    }

    const legacyByEmail = await Supabase.getOne('users', 'email', email, 'username,display_name,balance,total_deposit,email');
    const legacyByUsername = await Supabase.getOne('users', 'username', email, 'username,display_name,balance,total_deposit,email');
    const found = legacyByEmail || legacyByUsername;

    const username = this._normalizeUsernameFromEmail(email, found?.username || null);
    const hashedPlaceholder = await this._hash(`supabase-managed:${email}`);

    let existingUser = await Supabase.getOne('users', 'username', username, 'username,display_name,balance,total_deposit');
    if (!existingUser) {
      const created = await Supabase.insert('users', {
        username,
        password: hashedPlaceholder,
        display_name: profile.user_metadata?.full_name || profile.user_metadata?.name || email.split('@')[0],
        balance: 0,
        total_deposit: 0,
        email,
        avatar_url: profile.user_metadata?.avatar_url || '',
        auth_provider: 'password',
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      existingUser = created || { username, display_name: username, balance: 0 };
    } else {
      await Supabase.update('users', 'username', username, {
        email,
        password: hashedPlaceholder,
        avatar_url: profile.user_metadata?.avatar_url || '',
        auth_provider: 'password',
        display_name: existingUser.display_name || profile.user_metadata?.full_name || email.split('@')[0],
        last_login_at: new Date().toISOString(),
      });
    }

    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, username);
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_EMAIL, email);

    const user = {
      username,
      displayName: existingUser.display_name || username,
      balance: existingUser.balance || 0,
    };
    this._cachedUser = user;
    return user;
  },

  _saveAuthToken(accessToken) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_ACCESS_TOKEN, accessToken);
  },

  _clearAuthStorage() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_ACCESS_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_EMAIL);
    this._cachedUser = null;
  },

  _parseOAuthHash() {
    const hash = window.location.hash || '';
    if (!hash.includes('access_token') && !hash.includes('error')) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    return {
      accessToken: params.get('access_token') || '',
      refreshToken: params.get('refresh_token') || '',
      type: params.get('type') || '',
      error: params.get('error') || '',
      errorDescription: params.get('error_description') || '',
    };
  },

  _clearOAuthHashFromUrl() {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  },

  async _handleAuthRedirect() {
    const parsed = this._parseOAuthHash();
    if (!parsed) return null;

    this._clearOAuthHashFromUrl();

    if (parsed.error) {
      throw new Error(this._translateAuthError(parsed.errorDescription, 'Xác thực thất bại. Vui lòng thử lại.'));
    }
    if (!parsed.accessToken) {
      throw new Error('Không nhận được access token từ liên kết xác thực');
    }

    this._saveAuthToken(parsed.accessToken);
    const profile = await Supabase.getAuthUser(parsed.accessToken);

    if (!profile?.email_confirmed_at) {
      this._clearAuthStorage();
      throw new Error('Tài khoản chưa xác minh email. Vui lòng kiểm tra hộp thư.');
    }

    const user = await this._ensureUserByEmailProfile(profile);
    DB.recordDailyAccess(user.username);
    return { mode: 'login', user };
  },

  async _restoreSessionFromToken() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_ACCESS_TOKEN);
    if (!token) return null;

    try {
      const profile = await Supabase.getAuthUser(token);
      if (!profile?.email_confirmed_at) {
        this._clearAuthStorage();
        return null;
      }
      const user = await this._ensureUserByEmailProfile(profile);
      return user;
    } catch {
      this._clearAuthStorage();
      return null;
    }
  },

  _showAuthMessage(message, type = 'error') {
    const messageEl = document.getElementById('auth-form-message');
    if (!messageEl) return;

    const colorClass = type === 'success' ? 'text-green-400' : (type === 'warning' ? 'text-yellow-400' : 'text-red-400');
    messageEl.className = `text-xs ${colorClass}`;
    messageEl.textContent = message;
  },

  _clearAuthMessage() {
    const messageEl = document.getElementById('auth-form-message');
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.className = 'text-xs text-on-surface-variant';
  },

  _translateAuthError(rawMessage, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
    const source = String(rawMessage || '').trim();
    if (!source) return fallback;
    const message = source.toLowerCase();

    if (message.includes('invalid login credentials')) return 'Email hoặc mật khẩu không chính xác.';
    if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
      return 'Email chưa xác minh. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.';
    }
    if (message.includes('user already registered')) return 'Email này đã được đăng ký. Vui lòng đăng nhập.';
    if (message.includes('signup is disabled')) return 'Hệ thống tạm thời tắt đăng ký tài khoản mới.';
    if (message.includes('email rate limit exceeded')) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    if (message.includes('token has expired') || message.includes('expired')) {
      return 'Liên kết xác minh đã hết hạn. Vui lòng yêu cầu gửi lại email xác minh.';
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    }
    return source;
  },

  _setAuthTab(tab) {
    this._activeTab = tab;
    this._renderAuthForm(tab);
  },

  _clearRegisterSuccessNoticeTimer() {
    if (this._registerNoticeTimer) {
      clearTimeout(this._registerNoticeTimer);
      this._registerNoticeTimer = null;
    }
  },

  _getRegisterSuccessNoticeText(email) {
    return `Đăng ký thành công! Email xác nhận đã được gửi tới ${email}. Vui lòng kiểm tra email để hoàn tất đăng ký.`;
  },

  _showRegisterSuccessNotice(email) {
    const noticeEl = document.getElementById('auth-register-success-notice');
    if (!noticeEl) return;

    this._clearRegisterSuccessNoticeTimer();
    noticeEl.classList.remove('hidden');
    noticeEl.innerHTML = `
      <div class="bg-green-500/10 border border-green-500/40 rounded-xl p-3 text-green-200 text-sm flex items-start gap-2">
        <span class="material-symbols-outlined text-green-300 text-base">mark_email_read</span>
        <div class="flex-1 leading-relaxed">${this._getRegisterSuccessNoticeText(email)}</div>
        <button onclick="Auth._hideRegisterSuccessNotice()" class="text-green-200/80 hover:text-green-100 transition-colors">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    `;

    this._registerNoticeTimer = setTimeout(() => {
      this._hideRegisterSuccessNotice();
    }, 9000);
  },

  _hideRegisterSuccessNotice() {
    this._clearRegisterSuccessNoticeTimer();
    const noticeEl = document.getElementById('auth-register-success-notice');
    if (!noticeEl) return;
    noticeEl.classList.add('hidden');
    noticeEl.innerHTML = '';
  },

  async register(emailInput, password, confirmPassword = password) {
    const checked = this._validateRegistrationInput(emailInput, password, confirmPassword);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }

    try {
      await Supabase.signUpWithPassword(checked.email, password, CONFIG.AUTH.REDIRECT_URI);
      return {
        ok: true,
        requiresVerification: true,
        email: checked.email,
        message: 'Đăng ký thành công. Email xác nhận đã được gửi, vui lòng kiểm tra email để hoàn tất đăng ký.',
      };
    } catch (err) {
      return { ok: false, error: this._translateAuthError(err.message, 'Không thể đăng ký tài khoản') };
    }
  },

  async resendVerificationEmail(emailInput) {
    const checked = this._validateEmail(emailInput);
    if (!checked.ok) return { ok: false, error: checked.error };

    try {
      await Supabase.resendSignupVerification(checked.email, CONFIG.AUTH.REDIRECT_URI);
      return { ok: true, message: 'Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư.' };
    } catch (err) {
      return { ok: false, error: this._translateAuthError(err.message, 'Không thể gửi lại email xác minh') };
    }
  },

  async login(emailInput, password) {
    const checked = this._validateEmail(emailInput);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }
    if (!password) {
      return { ok: false, error: 'Vui lòng nhập mật khẩu' };
    }

    try {
      const payload = await Supabase.signInWithPassword(checked.email, password);
      const accessToken = payload?.access_token;
      if (!accessToken) {
        return { ok: false, error: 'Không tạo được phiên đăng nhập' };
      }

      this._saveAuthToken(accessToken);
      const profile = payload?.user || await Supabase.getAuthUser(accessToken);
      if (!profile?.email_confirmed_at) {
        this._clearAuthStorage();
        return { ok: false, error: 'Email chưa xác minh. Vui lòng xác minh trước khi đăng nhập.' };
      }

      const user = await this._ensureUserByEmailProfile(profile);
      DB.recordDailyAccess(user.username);
      return { ok: true, user };
    } catch (err) {
      return { ok: false, error: this._translateAuthError(err.message, 'Đăng nhập thất bại') };
    }
  },

  logout() {
    this._clearAuthStorage();
  },

  async getCurrentUser() {
    const username = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    if (!username) return null;

    if (this._cachedUser && this._cachedUser.username === username) {
      return this._cachedUser;
    }

    try {
      const user = await Supabase.getOne('users_public', 'username', username);
      if (!user) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
        return null;
      }
      this._cachedUser = {
        username: user.username,
        displayName: user.display_name || user.username,
        balance: user.balance || 0,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      };
      return this._cachedUser;
    } catch {
      return { username, displayName: username, balance: 0 };
    }
  },

  isLoggedIn() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  },

  getUsername() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER) || null;
  },

  renderNavAuth(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const username = this.getUsername();
    if (username) {
      const displayName = this._cachedUser?.displayName || username;
      container.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 bg-surface-container-highest/50 px-3 py-1.5 rounded-full">
            <div class="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center">
              <span class="text-[10px] font-black text-on-primary-container">${displayName.charAt(0).toUpperCase()}</span>
            </div>
            <span class="text-xs font-bold text-on-surface hidden sm:inline">${displayName}</span>
          </div>
          <button onclick="Auth.logout(); location.reload();" class="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">logout</span>
            <span class="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <button onclick="Auth.showAuthModal('login')" class="flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-all">
        <span class="material-symbols-outlined text-sm">login</span>
        <span>Đăng nhập</span>
      </button>
    `;
  },

  renderMobileAuth(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const username = this.getUsername();
    if (username) {
      const displayName = this._cachedUser?.displayName || username;
      container.innerHTML = `
        <div class="border-t border-zinc-800 pt-4 mt-4 flex flex-col gap-3">
          <div class="flex items-center gap-3 px-2">
            <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
              <span class="text-sm font-black text-on-primary-container">${displayName.charAt(0).toUpperCase()}</span>
            </div>
            <span class="text-sm font-bold">${displayName}</span>
          </div>
          <a href="#" onclick="Auth.logout(); location.reload(); return false;" class="text-red-400 flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">logout</span>
            Đăng xuất
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="border-t border-zinc-800 pt-4 mt-4">
        <a href="#" onclick="document.getElementById('mobile-menu').classList.remove('open'); Auth.showAuthModal('login'); return false;" class="text-primary-container font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-lg">login</span>
          Đăng nhập / Đăng ký
        </a>
      </div>
    `;
  },

  showAuthModal(defaultTab = 'login') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = '<div class="modal-content" id="auth-modal-content"></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) Utils.hideModal('auth-modal');
      });
    }

    this._setAuthTab(defaultTab);
    Utils.showModal('auth-modal');
  },

  _renderAuthForm(activeTab = 'login') {
    const content = document.getElementById('auth-modal-content');
    if (!content) return;

    const isLogin = activeTab === 'login';
    const isRegister = activeTab === 'register';

    const subtitle = isRegister
      ? 'Tạo tài khoản mới bằng Gmail để kích hoạt tài khoản.'
      : 'Đăng nhập an toàn bằng Gmail và mật khẩu.';

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">shield_lock</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Xác thực tài khoản</h3>
            <p class="text-xs text-on-surface-variant">${subtitle}</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('auth-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-4">
        <div class="tab-nav">
          <button class="tab-btn ${isLogin ? 'active' : ''}" onclick="Auth._setAuthTab('login')">Đăng nhập</button>
          <button class="tab-btn ${isRegister ? 'active' : ''}" onclick="Auth._setAuthTab('register')">Đăng ký</button>
        </div>

        <div id="auth-register-success-notice" class="hidden"></div>
        <div id="auth-form-message" class="text-xs text-on-surface-variant"></div>

        ${isLogin ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
              <input type="email" id="auth-login-email" autocomplete="email" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="you@gmail.com" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Mật khẩu</label>
              <input type="password" id="auth-login-password" autocomplete="current-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhập mật khẩu" onkeydown="if(event.key==='Enter') Auth._submitLogin()" />
            </div>
            <div class="flex items-center justify-end text-xs">
              <a href="#" onclick="Auth._submitResendVerification(); return false;" class="text-zinc-400 hover:text-zinc-200">Gửi lại email xác minh</a>
            </div>
          </div>
          <button id="auth-login-btn" onclick="Auth._submitLogin()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">login</span>
            <span>Đăng nhập qua Email</span>
          </button>

          <div class="relative py-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-zinc-800"></div>
            </div>
            <div class="relative flex justify-center">
              <span class="bg-surface-container text-xs text-zinc-500 px-3">HOẶC</span>
            </div>
          </div>

          <button onclick="Auth._submitGoogleLogin()" class="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Đăng nhập bằng Google</span>
          </button>
        ` : ''}

        ${isRegister ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
              <input type="email" id="auth-register-email" autocomplete="email" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="you@gmail.com" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Mật khẩu</label>
              <input type="password" id="auth-register-password" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Tối thiểu 8 ký tự" oninput="Auth._onRegisterPasswordInput()" />
              <p id="auth-password-strength" class="text-xs text-on-surface-variant">Độ mạnh mật khẩu: chưa đánh giá</p>
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Nhập lại mật khẩu</label>
              <input type="password" id="auth-register-confirm" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhập lại mật khẩu" onkeydown="if(event.key==='Enter') Auth._submitRegister()" />
            </div>
          </div>
          <button id="auth-register-btn" onclick="Auth._submitRegister()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">person_add</span>
            <span>Tạo tài khoản bằng Email</span>
          </button>

          <div class="relative py-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-zinc-800"></div>
            </div>
            <div class="relative flex justify-center">
              <span class="bg-surface-container text-xs text-zinc-500 px-3">HOẶC</span>
            </div>
          </div>

          <button onclick="Auth._submitGoogleLogin()" class="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Tiếp tục bằng Google</span>
          </button>
        ` : ''}
      </div>
    `;
  },

  _onRegisterPasswordInput() {
    const value = document.getElementById('auth-register-password')?.value || '';
    const el = document.getElementById('auth-password-strength');
    if (!el) return;
    const strength = this._checkPasswordStrength(value);
    const color = strength.ok ? 'text-green-400' : (strength.score >= 3 ? 'text-yellow-400' : 'text-red-400');
    el.className = `text-xs ${color}`;
    const tail = strength.missing.length ? ` - thiếu: ${strength.missing.join(', ')}` : '';
    el.textContent = `Độ mạnh mật khẩu: ${strength.label}${tail}`;
  },

  async _submitLogin() {
    const btn = document.getElementById('auth-login-btn');
    const email = document.getElementById('auth-login-email')?.value || '';
    const password = document.getElementById('auth-login-password')?.value || '';

    this._clearAuthMessage();
    Utils.setLoading(btn, true);
    try {
      const result = await this.login(email, password);
      if (!result.ok) {
        this._showAuthMessage(result.error, 'error');
        Utils.toast(result.error, 'error');
        return;
      }
      this.renderNavAuth('nav-auth');
      this.renderMobileAuth('mobile-auth');
      Utils.hideModal('auth-modal');
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: result.user }));
      Utils.toast(`Xin chào, ${result.user.displayName}!`, 'success');
    } finally {
      Utils.setLoading(btn, false);
    }
  },

  async _submitRegister() {
    const btn = document.getElementById('auth-register-btn');
    const email = document.getElementById('auth-register-email')?.value || '';
    const password = document.getElementById('auth-register-password')?.value || '';
    const confirmPassword = document.getElementById('auth-register-confirm')?.value || '';

    this._clearAuthMessage();
    this._hideRegisterSuccessNotice();
    Utils.setLoading(btn, true);
    try {
      const result = await this.register(email, password, confirmPassword);
      if (!result.ok) {
        this._showAuthMessage(result.error, 'error');
        Utils.toast(result.error, 'error');
        return;
      }
      this._showAuthMessage(result.message, 'success');
      Utils.toast(result.message, 'success', 9000);
      this._setAuthTab('login');
      setTimeout(() => {
        const loginEmail = document.getElementById('auth-login-email');
        if (loginEmail) loginEmail.value = result.email;
        this._showRegisterSuccessNotice(result.email);
      }, 0);
    } finally {
      Utils.setLoading(btn, false);
    }
  },

  async _submitGoogleLogin() {
    this._clearAuthMessage();
    try {
      await Supabase.signInWithOAuth('google', CONFIG.AUTH.REDIRECT_URI);
    } catch (err) {
      this._showAuthMessage(this._translateAuthError(err.message, 'Không thể đăng nhập bằng Google'), 'error');
      Utils.toast('Đăng nhập bằng Google thất bại', 'error');
    }
  },

  async _submitResendVerification() {
    const email = document.getElementById('auth-login-email')?.value || '';
    const result = await this.resendVerificationEmail(email);
    if (!result.ok) {
      this._showAuthMessage(result.error, 'error');
      Utils.toast(result.error, 'error');
      return;
    }
    this._showAuthMessage(result.message, 'success');
    Utils.toast(result.message, 'success');
  },

  requireLogin(callback) {
    if (this.isLoggedIn()) {
      callback();
      return;
    }
    Utils.toast('Vui lòng đăng nhập để tiếp tục', 'warning');
    this.showAuthModal('login');
    const handler = () => {
      window.removeEventListener('auth-changed', handler);
      callback();
    };
    window.addEventListener('auth-changed', handler);
  },

  initAuthUI() {
    this.init();
  },

  init() {
    this.renderNavAuth('nav-auth');
    this.renderMobileAuth('mobile-auth');

    this._handleAuthRedirect()
      .then((result) => {
        if (result?.mode === 'login' && result.user) {
          this.renderNavAuth('nav-auth');
          this.renderMobileAuth('mobile-auth');
          window.dispatchEvent(new CustomEvent('auth-changed', { detail: result.user }));
          Utils.toast(`Xin chào, ${result.user.displayName}!`, 'success');
          return;
        }

        if (this.isLoggedIn()) {
          const username = this.getUsername();
          DB.recordDailyAccess(username);
          this.getCurrentUser().then((currentUser) => {
            if (!currentUser) return;
            this._cachedUser = currentUser;
            this.renderNavAuth('nav-auth');
            this.renderMobileAuth('mobile-auth');
          });
          return;
        }

        this._restoreSessionFromToken().then((restoredUser) => {
          if (!restoredUser) return;
          DB.recordDailyAccess(restoredUser.username);
          this.renderNavAuth('nav-auth');
          this.renderMobileAuth('mobile-auth');
          window.dispatchEvent(new CustomEvent('auth-changed', { detail: restoredUser }));
        });
      })
      .catch((err) => {
        Utils.toast(err.message || 'Xác thực thất bại', 'error');
      });
  },
};
