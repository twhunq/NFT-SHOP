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
    signInWithPassword: async () => ({ access_token: 'token', user: { email: 'abc@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} } }),
    resendSignupVerification: async () => true,
    sendPasswordReset: async () => true,
    updateUserPassword: async () => ({}),
    getAuthUser: async () => ({ email: 'abc@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} }),
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
    Utils: { showModal: () => {}, hideModal: () => {}, toast: () => {}, setLoading: () => {} },
    DB: { recordDailyAccess: () => {} },
    Supabase: { ...supabase, ...(overrides.Supabase || {}) },
    CONFIG: {
      STORAGE_KEYS: { CURRENT_USER: 'cu', AUTH_ACCESS_TOKEN: 'tk', AUTH_EMAIL: 'em' },
      AUTH: { REDIRECT_URI: 'http://localhost/home.html' },
    },
    CustomEvent: class { constructor(name, data) { this.name = name; this.data = data; } },
    URLSearchParams,
    setTimeout,
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
  const result = await Auth.register('abc@example.com', 'Abcd1234!', 'Wrong123!');
  assert.equal(result.ok, false);
  assert.equal(result.error.includes('khong khop'), true);
});

test('integration: register triggers signup and requires verification', async () => {
  let receivedEmail = '';
  const { Auth } = await loadAuth({
    Supabase: {
      signUpWithPassword: async (email) => {
        receivedEmail = email;
        return {};
      },
    },
  });

  const result = await Auth.register('ABC@Example.com', 'Abcd1234!', 'Abcd1234!');
  assert.equal(result.ok, true);
  assert.equal(result.requiresVerification, true);
  assert.equal(receivedEmail, 'abc@example.com');
});

test('integration: login succeeds when account is verified', async () => {
  const { Auth, localStorage } = await loadAuth({
    Supabase: {
      signInWithPassword: async () => ({
        access_token: 'abc-token',
        user: { email: 'user@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {} },
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

  const result = await Auth.login('user@example.com', 'Abcd1234!');
  assert.equal(result.ok, true);
  assert.equal(result.user.username, 'user@example.com');
  assert.equal(localStorage.getItem('tk'), 'abc-token');
});

test('integration: auth modal renders login/register/forgot tabs and forgot link', async () => {
  const ctx = await loadAuth();
  const { Auth, document } = ctx;
  Auth.showAuthModal('login');

  const content = document.getElementById('auth-modal-content');
  assert.ok(content);
  assert.equal(content.innerHTML.includes('Dang nhap'), true);
  assert.equal(content.innerHTML.includes('Dang ky'), true);
  assert.equal(content.innerHTML.includes('Quen mat khau'), true);
});
