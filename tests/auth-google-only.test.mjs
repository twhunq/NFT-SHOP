import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

function createLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function createDocumentStub() {
  const nodes = new Map();
  function addNode(node) {
    if (node?.id) nodes.set(node.id, node);
  }
  const body = {
    appendChild: (el) => {
      addNode(el);
      return el;
    },
  };
  return {
    body,
    getElementById: (id) => nodes.get(id) || null,
    createElement: () => {
      const el = {
        id: '',
        className: '',
        _innerHTML: '',
        addEventListener: () => {},
      };
      Object.defineProperty(el, 'innerHTML', {
        get() {
          return this._innerHTML;
        },
        set(value) {
          this._innerHTML = value;
          if (typeof value === 'string' && value.includes('id="auth-modal-content"')) {
            addNode({
              id: 'auth-modal-content',
              innerHTML: '',
            });
          }
        },
      });
      return el;
    },
  };
}

async function loadAuth(overrides = {}) {
  const source = await fs.readFile(path.join(process.cwd(), 'js', 'auth.js'), 'utf8');
  const document = createDocumentStub();
  const supabase = {
    signUpWithPassword: async () => ({}),
    signInWithPassword: async () => ({ access_token: 'token', user: { email: 'abc@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} } }),
    resendSignupVerification: async () => true,
    sendPasswordReset: async () => true,
    updateUserPassword: async () => ({}),
    getAuthUser: async () => ({ email: 'abc@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} }),
    getOne: async () => null,
    insert: async () => null,
    update: async () => null,
  };

  const context = {
    console,
    TextEncoder,
    crypto: globalThis.crypto,
    localStorage: createLocalStorage(),
    history: { replaceState: () => {} },
    location: { hash: '', pathname: '/home.html', search: '' },
    window: { location: { href: '' }, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {}, location: { href: '' } },
    document,
    Utils: {
      showModal: () => {},
      hideModal: () => {},
      toast: () => {},
      setLoading: () => {},
      ...(overrides.Utils || {}),
    },
    DB: { recordDailyAccess: () => {} },
    Supabase: { ...supabase, ...(overrides.Supabase || {}) },
    CONFIG: {
      STORAGE_KEYS: { CURRENT_USER: 'cu', AUTH_ACCESS_TOKEN: 'tk', AUTH_EMAIL: 'em' },
      AUTH: { REDIRECT_URI: 'http://localhost/home.html' },
    },
    CustomEvent: class { constructor(name, data) { this.name = name; this.data = data; } },
    URLSearchParams,
    setTimeout: overrides.setTimeout || setTimeout,
    clearTimeout: overrides.clearTimeout || clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.Auth = Auth;`, context);
  return context;
}

test('unit: password strength checker rejects weak and accepts strong password', async () => {
  const { Auth } = await loadAuth();
  const weak = Auth._checkPasswordStrength('abc123');
  const strong = Auth._checkPasswordStrength('Abcd1234!');
  assert.equal(weak.ok, false);
  assert.equal(strong.ok, true);
});

test('unit: register validates mismatch confirm password', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('abc@gmail.com', 'Abcd1234!', 'Wrong123!');
  assert.equal(result.ok, false);
  assert.equal(result.error.includes('không khớp'), true);
});

test('integration: register with @gmail.com triggers signup and requires verification', async () => {
  let receivedEmail = '';
  const { Auth } = await loadAuth({
    Supabase: {
      signUpWithPassword: async (email) => {
        receivedEmail = email;
        return {};
      },
    },
  });

  const result = await Auth.register('ABC@GMAIL.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, true);
  assert.equal(result.requiresVerification, true);
  assert.equal(result.message.includes('vui lòng kiểm tra email'), true);
  assert.equal(receivedEmail, 'abc@gmail.com');
});

test('unit: pure @gmail.com is allowed', async () => {
  const { Auth } = await loadAuth();
  const result = Auth._validateEmail('abc123@gmail.com');
  assert.equal(result.ok, true);
  assert.equal(result.email, 'abc123@gmail.com');
});

test('unit: register returns clear error when email sending fails', async () => {
  const { Auth } = await loadAuth({
    Supabase: {
      signUpWithPassword: async () => {
        throw new Error('Không thể gửi email xác nhận');
      },
    },
  });
  const result = await Auth.register('abc@gmail.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Không thể gửi email xác nhận');
});

test('unit: register rejects non-gmail domain with clear Vietnamese message', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('abc@yahoo.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Chỉ cho phép đăng ký bằng địa chỉ @gmail.com');
});

test('unit: register rejects malformed email with clear Vietnamese message', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('abcgmail.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Email không hợp lệ');
});

test('unit: register rejects gmail submail with dot local-part', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('abc.xyz@gmail.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Email thuộc subdomain của Gmail không được phép đăng ký.');
});

test('unit: register rejects gmail submail with many dots', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('a.b.c.d@gmail.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Email thuộc subdomain của Gmail không được phép đăng ký.');
});

test('unit: register rejects domain subdomain of gmail.com', async () => {
  const { Auth } = await loadAuth();
  const result = await Auth.register('abc@sub.gmail.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Email thuộc subdomain của Gmail không được phép đăng ký.');
});

test('unit: translate invalid login credentials to Vietnamese', async () => {
  const { Auth } = await loadAuth({
    Supabase: {
      signInWithPassword: async () => {
        throw new Error('Invalid login credentials');
      },
    },
  });
  const result = await Auth.login('user@gmail.com', 'sai-mat-khau');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Email hoặc mật khẩu không chính xác.');
});

test('integration: login succeeds when account is verified', async () => {
  const { Auth, localStorage } = await loadAuth({
    Supabase: {
      signInWithPassword: async () => ({
        access_token: 'abc-token',
        user: { email: 'user@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} },
      }),
      getOne: async (table, col, val) => {
        if (table === 'users' && col === 'username') {
          return { username: val, display_name: 'User', balance: 0, total_deposit: 0 };
        }
        return null;
      },
      update: async () => ({}),
    },
  });

  const result = await Auth.login('user@gmail.com', 'Abcd1234!');
  assert.equal(result.ok, true);
  assert.equal(result.user.username, 'user@gmail.com');
  assert.equal(localStorage.getItem('tk'), 'abc-token');
});

test('integration: auth modal renders tiếng Việt có dấu và không còn quên mật khẩu', async () => {
  const ctx = await loadAuth();
  const { Auth, document } = ctx;
  Auth.showAuthModal('login');

  const content = document.getElementById('auth-modal-content');
  assert.ok(content);
  assert.equal(content.innerHTML.includes('Đăng nhập'), true);
  assert.equal(content.innerHTML.includes('Đăng ký'), true);
  assert.equal(content.innerHTML.includes('Quên mật khẩu'), false);
});

test('unit: register success notice renders and can auto-hide', async () => {
  const timers = [];
  const { Auth, document } = await loadAuth({
    setTimeout: (fn, ms) => {
      timers.push(ms);
      return 1;
    },
    clearTimeout: () => {},
  });

  const hiddenState = { value: true };
  const noticeEl = {
    innerHTML: '',
    classList: {
      remove: (cls) => {
        if (cls === 'hidden') hiddenState.value = false;
      },
      add: (cls) => {
        if (cls === 'hidden') hiddenState.value = true;
      },
    },
  };
  const originalGet = document.getElementById;
  document.getElementById = (id) => {
    if (id === 'auth-register-success-notice') return noticeEl;
    return originalGet(id);
  };

  Auth._showRegisterSuccessNotice('abc@gmail.com');
  assert.equal(hiddenState.value, false);
  assert.equal(noticeEl.innerHTML.includes('Email xác nhận đã được gửi tới abc@gmail.com'), true);
  assert.equal(timers.includes(9000), true);

  Auth._hideRegisterSuccessNotice();
  assert.equal(hiddenState.value, true);
});
