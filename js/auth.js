/**
 * ============================================
 *  NETFLIX PREMIUM - Authentication
 *  Password login/register + email verification
 * ============================================
 */

const Auth = {
  _cachedUser: null,
  _pendingResetToken: null,
  _activeTab: 'login',

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
    if (!email) return { ok: false, error: 'Vui long nhap email' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Email khong hop le' };
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
    let label = 'Yeu';
    if (score >= 5) label = 'Manh';
    else if (score >= 4) label = 'Kha';
    else if (score >= 3) label = 'Trung binh';

    const missing = [];
    if (!checks.length) missing.push('toi thieu 8 ky tu');
    if (!checks.lower) missing.push('chu thuong');
    if (!checks.upper) missing.push('chu hoa');
    if (!checks.number) missing.push('so');
    if (!checks.special) missing.push('ky tu dac biet');

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
        error: `Mat khau chua du manh (${passwordStrength.label}). Can bo sung: ${passwordStrength.missing.join(', ')}`,
      };
    }

    if (password !== confirmPassword) {
      return { ok: false, error: 'Nhap lai mat khau khong khop' };
    }

    return { ok: true, email: emailValidation.email };
  },

  _normalizeUsernameFromEmail(email, fallbackUsername = null) {
    if (fallbackUsername) return fallbackUsername;
    return this._normalizeEmail(email) || null;
  },

  async _ensureUserByEmailProfile(profile) {
    const email = this._normalizeEmail(profile?.email);
    if (!email) throw new Error('Khong lay duoc email tu phien dang nhap');

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
      throw new Error(parsed.errorDescription || 'Xac thuc that bai. Vui long thu lai.');
    }
    if (!parsed.accessToken) {
      throw new Error('Khong nhan duoc access token tu lien ket xac thuc');
    }

    this._saveAuthToken(parsed.accessToken);
    const profile = await Supabase.getAuthUser(parsed.accessToken);

    if (parsed.type === 'recovery') {
      this._pendingResetToken = parsed.accessToken;
      this.showAuthModal('reset');
      return { mode: 'recovery' };
    }

    if (!profile?.email_confirmed_at) {
      this._clearAuthStorage();
      throw new Error('Tai khoan chua xac minh email. Vui long kiem tra hop thu.');
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

  _setAuthTab(tab) {
    this._activeTab = tab;
    this._renderAuthForm(tab);
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
        message: 'Dang ky thanh cong. He thong da gui email xac minh.',
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Khong the dang ky tai khoan' };
    }
  },

  async resendVerificationEmail(emailInput) {
    const checked = this._validateEmail(emailInput);
    if (!checked.ok) return { ok: false, error: checked.error };

    try {
      await Supabase.resendSignupVerification(checked.email, CONFIG.AUTH.REDIRECT_URI);
      return { ok: true, message: 'Da gui lai email xac minh. Vui long kiem tra hop thu.' };
    } catch (err) {
      return { ok: false, error: err.message || 'Khong the gui lai email xac minh' };
    }
  },

  async login(emailInput, password) {
    const checked = this._validateEmail(emailInput);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }
    if (!password) {
      return { ok: false, error: 'Vui long nhap mat khau' };
    }

    try {
      const payload = await Supabase.signInWithPassword(checked.email, password);
      const accessToken = payload?.access_token;
      if (!accessToken) {
        return { ok: false, error: 'Khong tao duoc phien dang nhap' };
      }

      this._saveAuthToken(accessToken);
      const profile = payload?.user || await Supabase.getAuthUser(accessToken);
      if (!profile?.email_confirmed_at) {
        this._clearAuthStorage();
        return { ok: false, error: 'Email chua xac minh. Vui long xac minh truoc khi dang nhap.' };
      }

      const user = await this._ensureUserByEmailProfile(profile);
      DB.recordDailyAccess(user.username);
      return { ok: true, user };
    } catch (err) {
      const rawError = (err.message || '').toLowerCase();
      if (rawError.includes('email not confirmed') || rawError.includes('email_not_confirmed')) {
        return { ok: false, error: 'Email chua xac minh. Vui long kiem tra hop thu de kich hoat tai khoan.' };
      }
      return { ok: false, error: err.message || 'Dang nhap that bai' };
    }
  },

  async requestPasswordReset(emailInput) {
    const checked = this._validateEmail(emailInput);
    if (!checked.ok) {
      return { ok: false, error: checked.error };
    }

    try {
      await Supabase.sendPasswordReset(checked.email, CONFIG.AUTH.REDIRECT_URI);
      return { ok: true, message: 'Da gui email dat lai mat khau. Vui long kiem tra hop thu.' };
    } catch (err) {
      return { ok: false, error: err.message || 'Khong the gui email dat lai mat khau' };
    }
  },

  async resetPassword(newPassword, confirmPassword) {
    if (!this._pendingResetToken) {
      return { ok: false, error: 'Phien dat lai mat khau khong hop le. Vui long yeu cau lai.' };
    }

    const strength = this._checkPasswordStrength(newPassword);
    if (!strength.ok) {
      return {
        ok: false,
        error: `Mat khau moi chua du manh (${strength.label}). Can bo sung: ${strength.missing.join(', ')}`,
      };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: 'Nhap lai mat khau khong khop' };
    }

    try {
      await Supabase.updateUserPassword(this._pendingResetToken, newPassword);
      this._pendingResetToken = null;
      this._clearAuthStorage();
      return { ok: true, message: 'Da cap nhat mat khau moi. Vui long dang nhap lai.' };
    } catch (err) {
      return { ok: false, error: err.message || 'Khong the dat lai mat khau' };
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
            <span class="hidden sm:inline">Dang xuat</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <button onclick="Auth.showAuthModal('login')" class="flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-all">
        <span class="material-symbols-outlined text-sm">login</span>
        <span>Dang nhap</span>
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
            Dang xuat
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="border-t border-zinc-800 pt-4 mt-4">
        <a href="#" onclick="document.getElementById('mobile-menu').classList.remove('open'); Auth.showAuthModal('login'); return false;" class="text-primary-container font-bold flex items-center gap-2">
          <span class="material-symbols-outlined text-lg">login</span>
          Dang nhap / Dang ky
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
    const isForgot = activeTab === 'forgot';
    const isReset = activeTab === 'reset';

    const subtitle = isRegister
      ? 'Tao tai khoan moi va xac minh email truoc khi kich hoat'
      : isForgot
        ? 'Nhan email dat lai mat khau'
        : isReset
          ? 'Dat lai mat khau moi cho tai khoan'
          : 'Dang nhap an toan voi email va mat khau';

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">shield_lock</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">Xac thuc tai khoan</h3>
            <p class="text-xs text-on-surface-variant">${subtitle}</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('auth-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-4">
        <div class="tab-nav">
          <button class="tab-btn ${isLogin ? 'active' : ''}" onclick="Auth._setAuthTab('login')">Dang nhap</button>
          <button class="tab-btn ${isRegister ? 'active' : ''}" onclick="Auth._setAuthTab('register')">Dang ky</button>
          <button class="tab-btn ${isForgot ? 'active' : ''}" onclick="Auth._setAuthTab('forgot')">Quen mat khau</button>
        </div>

        <div id="auth-form-message" class="text-xs text-on-surface-variant"></div>

        ${isLogin ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
              <input type="email" id="auth-login-email" autocomplete="email" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="you@example.com" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Mat khau</label>
              <input type="password" id="auth-login-password" autocomplete="current-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhap mat khau" onkeydown="if(event.key==='Enter') Auth._submitLogin()" />
            </div>
            <div class="flex items-center justify-between text-xs">
              <a href="#" onclick="Auth._setAuthTab('forgot'); return false;" class="text-primary-container hover:underline">Quen mat khau?</a>
              <a href="#" onclick="Auth._submitResendVerification(); return false;" class="text-zinc-400 hover:text-zinc-200">Gui lai email xac minh</a>
            </div>
          </div>
          <button id="auth-login-btn" onclick="Auth._submitLogin()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">login</span>
            <span>Dang nhap</span>
          </button>
        ` : ''}

        ${isRegister ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Email</label>
              <input type="email" id="auth-register-email" autocomplete="email" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="you@example.com" />
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Mat khau</label>
              <input type="password" id="auth-register-password" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Toi thieu 8 ky tu" oninput="Auth._onRegisterPasswordInput()" />
              <p id="auth-password-strength" class="text-xs text-on-surface-variant">Do manh mat khau: chua danh gia</p>
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Nhap lai mat khau</label>
              <input type="password" id="auth-register-confirm" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhap lai mat khau" onkeydown="if(event.key==='Enter') Auth._submitRegister()" />
            </div>
          </div>
          <button id="auth-register-btn" onclick="Auth._submitRegister()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">person_add</span>
            <span>Tao tai khoan</span>
          </button>
        ` : ''}

        ${isForgot ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Email tai khoan</label>
              <input type="email" id="auth-forgot-email" autocomplete="email" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="you@example.com" onkeydown="if(event.key==='Enter') Auth._submitForgotPassword()" />
            </div>
          </div>
          <button id="auth-forgot-btn" onclick="Auth._submitForgotPassword()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">mail</span>
            <span>Gui email dat lai mat khau</span>
          </button>
        ` : ''}

        ${isReset ? `
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Mat khau moi</label>
              <input type="password" id="auth-reset-password" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhap mat khau moi" oninput="Auth._onResetPasswordInput()" />
              <p id="auth-reset-strength" class="text-xs text-on-surface-variant">Do manh mat khau: chua danh gia</p>
            </div>
            <div class="space-y-1">
              <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500">Nhap lai mat khau moi</label>
              <input type="password" id="auth-reset-confirm" autocomplete="new-password" class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 px-4 rounded-xl text-sm" placeholder="Nhap lai mat khau moi" onkeydown="if(event.key==='Enter') Auth._submitResetPassword()" />
            </div>
          </div>
          <button id="auth-reset-btn" onclick="Auth._submitResetPassword()" class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">password</span>
            <span>Cap nhat mat khau moi</span>
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
    const tail = strength.missing.length ? ` - thieu: ${strength.missing.join(', ')}` : '';
    el.textContent = `Do manh mat khau: ${strength.label}${tail}`;
  },

  _onResetPasswordInput() {
    const value = document.getElementById('auth-reset-password')?.value || '';
    const el = document.getElementById('auth-reset-strength');
    if (!el) return;
    const strength = this._checkPasswordStrength(value);
    const color = strength.ok ? 'text-green-400' : (strength.score >= 3 ? 'text-yellow-400' : 'text-red-400');
    el.className = `text-xs ${color}`;
    const tail = strength.missing.length ? ` - thieu: ${strength.missing.join(', ')}` : '';
    el.textContent = `Do manh mat khau: ${strength.label}${tail}`;
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
      Utils.toast(`Xin chao, ${result.user.displayName}!`, 'success');
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
    Utils.setLoading(btn, true);
    try {
      const result = await this.register(email, password, confirmPassword);
      if (!result.ok) {
        this._showAuthMessage(result.error, 'error');
        Utils.toast(result.error, 'error');
        return;
      }
      this._showAuthMessage(result.message, 'success');
      Utils.toast(result.message, 'success', 6000);
      this._setAuthTab('login');
      setTimeout(() => {
        const loginEmail = document.getElementById('auth-login-email');
        if (loginEmail) loginEmail.value = result.email;
      }, 0);
    } finally {
      Utils.setLoading(btn, false);
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

  async _submitForgotPassword() {
    const btn = document.getElementById('auth-forgot-btn');
    const email = document.getElementById('auth-forgot-email')?.value || '';

    this._clearAuthMessage();
    Utils.setLoading(btn, true);
    try {
      const result = await this.requestPasswordReset(email);
      if (!result.ok) {
        this._showAuthMessage(result.error, 'error');
        Utils.toast(result.error, 'error');
        return;
      }
      this._showAuthMessage(result.message, 'success');
      Utils.toast(result.message, 'success');
    } finally {
      Utils.setLoading(btn, false);
    }
  },

  async _submitResetPassword() {
    const btn = document.getElementById('auth-reset-btn');
    const password = document.getElementById('auth-reset-password')?.value || '';
    const confirmPassword = document.getElementById('auth-reset-confirm')?.value || '';

    this._clearAuthMessage();
    Utils.setLoading(btn, true);
    try {
      const result = await this.resetPassword(password, confirmPassword);
      if (!result.ok) {
        this._showAuthMessage(result.error, 'error');
        Utils.toast(result.error, 'error');
        return;
      }
      Utils.toast(result.message, 'success');
      this._setAuthTab('login');
    } finally {
      Utils.setLoading(btn, false);
    }
  },

  requireLogin(callback) {
    if (this.isLoggedIn()) {
      callback();
      return;
    }
    Utils.toast('Vui long dang nhap de tiep tuc', 'warning');
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
          Utils.toast(`Xin chao, ${result.user.displayName}!`, 'success');
          return;
        }
        if (result?.mode === 'recovery') {
          Utils.toast('Vui long nhap mat khau moi de hoan tat khoi phuc tai khoan', 'info');
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
        Utils.toast(err.message || 'Xac thuc that bai', 'error');
      });
  },
};
