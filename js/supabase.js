/**
 * ============================================
 *  NETFLIX PREMIUM – Supabase REST Client
 *  Kết nối trực tiếp qua REST API (không cần SDK)
 * ============================================
 */

const Supabase = {
  _authHeaders(accessToken = null) {
    const token = accessToken || CONFIG.SUPABASE.ANON_KEY;
    return {
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  },

  /**
   * Gọi Supabase REST API
   * @param {string} table - Tên bảng
   * @param {object} options - { method, filters, body, select, order, limit, single }
   */
  async query(table, options = {}) {
    const {
      method = 'GET',
      filters = '',
      body = null,
      select = '*',
      order = '',
      limit = '',
      single = false,
      upsert = false,
    } = options;

    let url = `${CONFIG.SUPABASE.URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    if (filters) url += `&${filters}`;
    if (order) url += `&order=${encodeURIComponent(order)}`;
    if (limit) url += `&limit=${limit}`;

    const headers = this._authHeaders();

    if (single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    if (method === 'POST' && upsert) {
      headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    } else if (method === 'POST') {
      headers['Prefer'] = 'return=representation';
    } else if (method === 'PATCH') {
      headers['Prefer'] = 'return=representation';
    } else if (method === 'DELETE') {
      headers['Prefer'] = 'return=representation';
    }

    const fetchOptions = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, fetchOptions);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`[Supabase] ${method} ${table} error:`, res.status, errData);
        throw new Error(errData.message || errData.details || `Supabase error ${res.status}`);
      }

      // DELETE with no content
      if (res.status === 204) return null;

      const data = await res.json();
      return data;
    } catch (err) {
      if (err.message?.includes('Failed to fetch')) {
        throw new Error('Không thể kết nối Supabase. Kiểm tra kết nối mạng.');
      }
      throw err;
    }
  },

  // ── Shorthand methods ─────────────────────

  /** SELECT * FROM table WHERE ... */
  async from(table) {
    return {
      select: (columns = '*') => ({
        eq: (col, val) => Supabase.query(table, {
          select: columns,
          filters: `${col}=eq.${encodeURIComponent(val)}`,
        }),
        order: (col, opts = {}) => ({
          eq: (filterCol, filterVal) => Supabase.query(table, {
            select: columns,
            filters: `${filterCol}=eq.${encodeURIComponent(filterVal)}`,
            order: `${col}.${opts.ascending ? 'asc' : 'desc'}`,
          }),
          limit: (n) => ({
            execute: () => Supabase.query(table, {
              select: columns,
              order: `${col}.${opts.ascending ? 'asc' : 'desc'}`,
              limit: n,
            }),
          }),
          execute: () => Supabase.query(table, {
            select: columns,
            order: `${col}.${opts.ascending ? 'asc' : 'desc'}`,
          }),
        }),
        execute: () => Supabase.query(table, { select: columns }),
      }),
    };
  },

  /** INSERT INTO table */
  async insert(table, data) {
    const result = await this.query(table, {
      method: 'POST',
      body: data,
    });
    return Array.isArray(result) ? result[0] : result;
  },

  /** UPDATE table SET ... WHERE col = val */
  async update(table, col, val, updates) {
    const result = await this.query(table, {
      method: 'PATCH',
      filters: `${col}=eq.${encodeURIComponent(val)}`,
      body: updates,
    });
    return Array.isArray(result) ? result[0] : result;
  },

  /** DELETE FROM table WHERE col = val */
  async delete(table, col, val) {
    return this.query(table, {
      method: 'DELETE',
      filters: `${col}=eq.${encodeURIComponent(val)}`,
    });
  },

  /** SELECT single row */
  async getOne(table, col, val, select = '*') {
    try {
      const rows = await this.query(table, {
        filters: `${col}=eq.${encodeURIComponent(val)}`,
        select,
        limit: '1',
      });
      return Array.isArray(rows) ? (rows[0] || null) : (rows || null);
    } catch {
      return null;
    }
  },

  /** SELECT multiple rows with filters */
  async getMany(table, filters = '', options = {}) {
    return this.query(table, {
      filters,
      ...options,
    });
  },

  // ── Supabase Auth (Password + Email Verification) ──
  async _parseAuthError(res, fallbackMessage) {
    const errData = await res.json().catch(() => ({}));
    const message = errData.error_description || errData.msg || errData.message || fallbackMessage;
    throw new Error(message);
  },

  async signInWithOAuth(provider, redirectTo = '') {
    const finalRedirect = redirectTo || CONFIG.AUTH.REDIRECT_URI;
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(finalRedirect)}`;
    window.location.href = url;
  },

  async signUpWithPassword(email, password, redirectTo = '') {
    const finalRedirect = redirectTo || CONFIG.AUTH.REDIRECT_URI;
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/signup`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: { auth_provider: 'password' },
        options: {
          email_redirect_to: finalRedirect,
        },
      }),
    });

    if (!res.ok) {
      await this._parseAuthError(res, 'Không thể đăng ký tài khoản');
    }

    return res.json();
  },

  async signInWithPassword(email, password) {
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      await this._parseAuthError(res, 'Đăng nhập thất bại');
    }

    return res.json();
  },

  async resendSignupVerification(email, redirectTo = '') {
    const finalRedirect = redirectTo || CONFIG.AUTH.REDIRECT_URI;
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/resend`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({
        email,
        type: 'signup',
        options: {
          email_redirect_to: finalRedirect,
        },
      }),
    });

    if (!res.ok) {
      await this._parseAuthError(res, 'Không thể gửi lại email xác minh');
    }

    return true;
  },

  async sendPasswordReset(email, redirectTo = '') {
    const finalRedirect = redirectTo || CONFIG.AUTH.REDIRECT_URI;
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/recover`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({
        email,
        redirect_to: finalRedirect,
      }),
    });

    if (!res.ok) {
      await this._parseAuthError(res, 'Không thể gửi email đặt lại mật khẩu');
    }

    return true;
  },

  async updateUserPassword(accessToken, newPassword) {
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/user`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this._authHeaders(accessToken),
      body: JSON.stringify({
        password: newPassword,
      }),
    });

    if (!res.ok) {
      await this._parseAuthError(res, 'Không thể cập nhật mật khẩu');
    }

    return res.json();
  },

  async getAuthUser(accessToken) {
    const url = `${CONFIG.SUPABASE.URL}/auth/v1/user`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this._authHeaders(accessToken),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error_description || errData.msg || 'Không thể lấy thông tin tài khoản');
    }

    return res.json();
  },
};
