/**
 * ============================================
 *  NETFLIX PREMIUM – Authentication
 *  (Supabase users table + localStorage session)
 * ============================================
 */

const Auth = {
  // ── Hash password with SHA-256 ───────────
  async _hash(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── Register ─────────────────────────────
  async register(username, password) {
    username = username.trim().toLowerCase();

    if (!username || username.length < 3) {
      return { ok: false, error: 'Tên đăng nhập tối thiểu 3 ký tự' };
    }
    if (/[^a-z0-9_.]/.test(username)) {
      return { ok: false, error: 'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm và gạch dưới' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Mật khẩu tối thiểu 4 ký tự' };
    }

    // Check if user exists
    const existing = await Supabase.getOne('users', 'username', username);
    if (existing) {
      return { ok: false, error: 'Tên đăng nhập đã tồn tại' };
    }

    const passwordHash = await this._hash(password);
    const user = {
      username,
      password: passwordHash,
      display_name: username,
      balance: 0,
      total_deposit: 0,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await Supabase.insert('users', user);

    // Auto login after register
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, username);

    return {
      ok: true,
      user: {
        username,
        displayName: username,
        balance: 0,
      },
    };
  },

  // ── Login ────────────────────────────────
  async login(username, password) {
    username = username.trim().toLowerCase();

    if (!username || !password) {
      return { ok: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu' };
    }

    const user = await Supabase.getOne('users', 'username', username, 'username,password');
    if (!user) {
      return { ok: false, error: 'Tài khoản không tồn tại' };
    }

    const passwordHash = await this._hash(password);
    if (user.password !== passwordHash) {
      return { ok: false, error: 'Mật khẩu không đúng' };
    }

    // Update last login
    await Supabase.update('users', 'username', username, {
      last_login_at: new Date().toISOString(),
    });

    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, username);

    return {
      ok: true,
      user: {
        username: user.username,
        displayName: user.display_name || user.username,
        balance: user.balance || 0,
      },
    };
  },

  // ── Logout ───────────────────────────────
  logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  },

  // ── Get current user (cached in localStorage) ─────
  // Returns { username, displayName } or null
  _cachedUser: null,

  async getCurrentUser() {
    const username = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    if (!username) return null;

    // Use cache if available
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
      // If Supabase is unreachable, still show as logged in
      return { username, displayName: username, balance: 0 };
    }
  },

  // ── Sync checks (for UI rendering without await) ──
  isLoggedIn() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  },

  getUsername() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER) || null;
  },

  // ── Render nav bar auth section ──────────
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
          <button onclick="Auth.logout(); location.reload();" 
            class="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">logout</span>
            <span class="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button onclick="Auth.showAuthModal()" 
          class="flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-all">
          <span class="material-symbols-outlined text-sm">person</span>
          <span>Đăng nhập</span>
        </button>
      `;
    }
  },

  // ── Render mobile menu auth ──────────────
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
    } else {
      container.innerHTML = `
        <div class="border-t border-zinc-800 pt-4 mt-4">
          <a href="#" onclick="document.getElementById('mobile-menu').classList.remove('open'); Auth.showAuthModal(); return false;" 
            class="text-primary-container font-bold flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">person</span>
            Đăng nhập / Đăng ký
          </a>
        </div>
      `;
    }
  },

  // ── Show auth modal ──────────────────────
  showAuthModal(defaultTab = 'login') {
    // Create modal if not exists
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

    this._renderAuthForm(defaultTab);
    Utils.showModal('auth-modal');
  },

  // ── Render auth form ─────────────────────
  _renderAuthForm(tab = 'login') {
    const content = document.getElementById('auth-modal-content');
    if (!content) return;

    const isLogin = tab === 'login';

    content.innerHTML = `
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary-container">${isLogin ? 'login' : 'person_add'}</span>
          </div>
          <div>
            <h3 class="text-xl font-black font-headline tracking-tight text-on-surface">${isLogin ? 'Đăng nhập' : 'Đăng ký'}</h3>
            <p class="text-xs text-on-surface-variant">${isLogin ? 'Đăng nhập để quản lý đơn hàng' : 'Tạo tài khoản mới miễn phí'}</p>
          </div>
        </div>
        <button onclick="Utils.hideModal('auth-modal')" class="text-on-surface-variant hover:text-on-surface transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="modal-body space-y-5">
        <!-- Tab Switch -->
        <div class="flex bg-surface-container-highest rounded-lg p-1 gap-1">
          <button onclick="Auth._renderAuthForm('login')" 
            class="flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${isLogin ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}">
            Đăng nhập
          </button>
          <button onclick="Auth._renderAuthForm('register')" 
            class="flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${!isLogin ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}">
            Đăng ký
          </button>
        </div>

        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Tên đăng nhập</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">person</span>
              <input type="text" id="auth-username" 
                class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 pl-10 pr-4 rounded-xl transition-all placeholder:text-zinc-600 text-sm"
                placeholder="VD: trung123"
                autocomplete="username"
                onkeydown="if(event.key==='Enter') document.getElementById('auth-password').focus()"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Mật khẩu</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">lock</span>
              <input type="password" id="auth-password" 
                class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 pl-10 pr-4 rounded-xl transition-all placeholder:text-zinc-600 text-sm"
                placeholder="${isLogin ? 'Nhập mật khẩu' : 'Tối thiểu 4 ký tự'}"
                autocomplete="${isLogin ? 'current-password' : 'new-password'}"
                onkeydown="if(event.key==='Enter') Auth._submitAuth('${tab}')"
              />
            </div>
          </div>

          ${!isLogin ? `
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Xác nhận mật khẩu</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">lock</span>
              <input type="password" id="auth-password-confirm" 
                class="w-full bg-surface-container-highest border-2 border-surface-container-highest focus:border-primary-container text-on-surface py-3 pl-10 pr-4 rounded-xl transition-all placeholder:text-zinc-600 text-sm"
                placeholder="Nhập lại mật khẩu"
                autocomplete="new-password"
                onkeydown="if(event.key==='Enter') Auth._submitAuth('${tab}')"
              />
            </div>
          </div>
          ` : ''}

          <!-- Error message -->
          <div id="auth-error" class="hidden bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">error</span>
            <span id="auth-error-text"></span>
          </div>
        </div>

        <button id="auth-submit-btn" onclick="Auth._submitAuth('${tab}')"
          class="w-full py-4 bg-primary-container text-on-primary-container rounded-xl font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-primary-container/20 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">${isLogin ? 'login' : 'person_add'}</span>
          <span>${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</span>
        </button>

        <p class="text-center text-xs text-zinc-500">
          ${isLogin 
            ? 'Chưa có tài khoản? <button onclick="Auth._renderAuthForm(\'register\')" class="text-primary-container font-bold hover:underline">Đăng ký ngay</button>' 
            : 'Đã có tài khoản? <button onclick="Auth._renderAuthForm(\'login\')" class="text-primary-container font-bold hover:underline">Đăng nhập</button>'}
        </p>
      </div>
    `;

    // Auto focus username
    setTimeout(() => {
      document.getElementById('auth-username')?.focus();
    }, 100);
  },

  // ── Submit auth form ─────────────────────
  async _submitAuth(tab) {
    const username = document.getElementById('auth-username')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;
    const errorEl = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');
    const btn = document.getElementById('auth-submit-btn');

    // Hide previous error
    errorEl?.classList.add('hidden');

    if (tab === 'register') {
      const confirmPass = document.getElementById('auth-password-confirm')?.value;
      if (password !== confirmPass) {
        errorEl?.classList.remove('hidden');
        if (errorText) errorText.textContent = 'Mật khẩu xác nhận không khớp';
        return;
      }
    }

    Utils.setLoading(btn, true);

    try {
      const result = tab === 'login'
        ? await this.login(username, password)
        : await this.register(username, password);

      if (result.ok) {
        Utils.hideModal('auth-modal');
        Utils.toast(tab === 'login' ? `Xin chào, ${result.user.displayName}!` : 'Đăng ký thành công!', 'success');
        
        // Update cache
        this._cachedUser = result.user;

        // Update all nav auth sections on the page
        this.renderNavAuth('nav-auth');
        this.renderMobileAuth('mobile-auth');

        // Trigger custom event for pages to react
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: result.user }));
      } else {
        errorEl?.classList.remove('hidden');
        if (errorText) errorText.textContent = result.error;
        Utils.setLoading(btn, false);
      }
    } catch (err) {
      errorEl?.classList.remove('hidden');
      if (errorText) errorText.textContent = err.message;
      Utils.setLoading(btn, false);
    }
  },

  // ── Require login (guard) ────────────────
  requireLogin(callback) {
    if (this.isLoggedIn()) {
      callback();
    } else {
      Utils.toast('Vui lòng đăng nhập để tiếp tục', 'warning');
      this.showAuthModal('login');
      // Listen for auth change to run callback
      const handler = () => {
        window.removeEventListener('auth-changed', handler);
        callback();
      };
      window.addEventListener('auth-changed', handler);
    }
  },

  // ── Init: render auth on page load ───────
  init() {
    this.renderNavAuth('nav-auth');
    this.renderMobileAuth('mobile-auth');
    
    // Pre-fetch user data if logged in
    if (this.isLoggedIn()) {
      this.getCurrentUser().then(user => {
        if (user) {
          this._cachedUser = user;
          // Re-render with display name
          this.renderNavAuth('nav-auth');
          this.renderMobileAuth('mobile-auth');
        }
      });
    }
  },
};
