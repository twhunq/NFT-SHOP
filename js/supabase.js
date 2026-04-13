/**
 * ============================================
 *  NETFLIX PREMIUM – Supabase REST Client
 *  Kết nối trực tiếp qua REST API (không cần SDK)
 * ============================================
 */

const Supabase = {
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

    const headers = {
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`,
      'Content-Type': 'application/json',
    };

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
      return await this.query(table, {
        filters: `${col}=eq.${encodeURIComponent(val)}`,
        select,
        single: true,
      });
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
};
