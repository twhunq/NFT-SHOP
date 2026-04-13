/**
 * ============================================
 *  NETFLIX PREMIUM – Database (Supabase)
 *  Bảng orders dùng UUID id (Supabase default)
 *  + order_code (TEXT) cho display (VD: NFLX-ABC123)
 * ============================================
 */

const DB = {
  // ── Generate display order code ──────────
  generateOrderCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return `${CONFIG.ORDER_PREFIX}-${id}`;
  },

  // ── Generate unique payment reference ────
  generatePaymentRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return rand;
  },

  // ── CRUD Operations ─────────────────────

  async createOrder(data) {
    const orderCode = this.generateOrderCode();
    const currentUser = Auth.getUsername() || 'guest';
    const order = {
      order_code: orderCode,
      type: data.type || 'mobile',
      username: currentUser,          // Original schema column (NOT NULL)
      user_id: currentUser,           // Migration column
      email: data.email || '',
      phone: data.phone || '',
      amount: CONFIG.PRICE,
      status: 'pending',
      payment_ref: this.generatePaymentRef(),

      // Mobile/PC fields
      login_link: '',
      nftoken: '',
      cookie_id: '',
      account_info: null,

      // TV fields
      tv_code: '',
      tv_login_status: '',

      // Transaction
      transaction_id: '',
      transaction_date: '',

      // Support
      refresh_count: 0,
      last_refresh_at: null,

      // Timestamps
      paid_at: null,
      completed_at: null,
      expires_at: null,
    };

    const result = await Supabase.insert('orders', order);
    return this._toFrontendOrder(result);
  },

  // ── Lookup by order_code (display ID like NFLX-ABC123) ──
  async getOrder(orderCode) {
    // Try order_code first (frontend display ID)
    let row = await Supabase.getOne('orders', 'order_code', orderCode);
    if (!row) {
      // Fallback: try UUID id
      row = await Supabase.getOne('orders', 'id', orderCode);
    }
    return row ? this._toFrontendOrder(row) : null;
  },

  async getOrderByPaymentRef(ref) {
    const row = await Supabase.getOne('orders', 'payment_ref', ref);
    return row ? this._toFrontendOrder(row) : null;
  },

  async getOrderByLink(link) {
    const row = await Supabase.getOne('orders', 'login_link', link);
    return row ? this._toFrontendOrder(row) : null;
  },

  async getOrderByCookieId(cookieId) {
    const row = await Supabase.getOne('orders', 'cookie_id', cookieId);
    return row ? this._toFrontendOrder(row) : null;
  },

  async updateOrder(orderCode, updates) {
    const dbUpdates = this._toDbOrder(updates);
    // Update by order_code (frontend display ID)
    let result = await Supabase.update('orders', 'order_code', orderCode, dbUpdates);
    if (!result) {
      // Fallback: try UUID id
      result = await Supabase.update('orders', 'id', orderCode, dbUpdates);
    }
    return result ? this._toFrontendOrder(result) : null;
  },

  async deleteOrder(orderCode) {
    await Supabase.delete('orders', 'order_code', orderCode);
  },

  async getAllOrders() {
    const rows = await Supabase.query('orders', {
      order: 'created_at.desc',
    });
    return (rows || []).map(r => this._toFrontendOrder(r));
  },

  // ── Get orders for current logged-in user ──
  async getMyOrders() {
    const username = Auth.getUsername();
    if (!username) return [];
    const rows = await Supabase.query('orders', {
      filters: `user_id=eq.${encodeURIComponent(username)}`,
      order: 'created_at.desc',
    });
    return (rows || []).map(r => this._toFrontendOrder(r));
  },

  // ── Check if order belongs to current user ──
  async isMyOrder(orderCode) {
    const username = Auth.getUsername();
    if (!username) return false;
    const order = await this.getOrder(orderCode);
    return order && order.userId === username;
  },

  async getOrdersByStatus(status) {
    const rows = await Supabase.query('orders', {
      filters: `status=eq.${status}`,
      order: 'created_at.desc',
    });
    return (rows || []).map(r => this._toFrontendOrder(r));
  },

  // ── Support Logs ─────────────────────────
  // support_logs.order_id references orders.id (UUID)
  async addSupportLog(orderCode, log) {
    // Need the UUID id of the order
    const order = await this._getOrderRow(orderCode);
    if (!order) return null;

    const entry = {
      order_id: order.id,  // UUID
      action: log.action,
      result: log.result,
      details: log.details || '',
    };
    await Supabase.insert('support_logs', entry);
    return this.getOrder(orderCode);
  },

  async getSupportLogs(orderCode) {
    // Need UUID id
    const order = await this._getOrderRow(orderCode);
    if (!order) return [];

    const rows = await Supabase.query('support_logs', {
      filters: `order_id=eq.${order.id}`,
      order: 'created_at.desc',
    });
    return rows || [];
  },

  // ── Get raw order row (with UUID id) ─────
  async _getOrderRow(orderCode) {
    let row = await Supabase.getOne('orders', 'order_code', orderCode);
    if (!row) {
      row = await Supabase.getOne('orders', 'id', orderCode);
    }
    return row;
  },

  // ── Check refresh eligibility ────────────
  async canRefresh(orderCode) {
    const order = await this.getOrder(orderCode);
    if (!order) return { allowed: false, reason: 'Không tìm thấy đơn hàng' };

    if (order.refreshCount >= CONFIG.SUPPORT.MAX_REFRESH) {
      const lastRefresh = new Date(order.lastRefreshAt);
      const windowEnd = new Date(lastRefresh.getTime() + CONFIG.SUPPORT.REFRESH_WINDOW_HOURS * 60 * 60 * 1000);
      if (new Date() < windowEnd) {
        const remaining = Math.ceil((windowEnd - new Date()) / (60 * 60 * 1000));
        return { allowed: false, reason: `Đã hết ${CONFIG.SUPPORT.MAX_REFRESH} lượt. Thử lại sau ${remaining} giờ` };
      }
      // Reset counter after window
      await this.updateOrder(orderCode, { refreshCount: 0 });
    }
    return { allowed: true };
  },

  async incrementRefresh(orderCode) {
    const order = await this.getOrder(orderCode);
    if (!order) return;
    await this.updateOrder(orderCode, {
      refreshCount: order.refreshCount + 1,
      lastRefreshAt: new Date().toISOString(),
    });
  },

  // ── Analytics ────────────────────────────
  async getStats() {
    const orders = await this.getAllOrders();
    const completed = orders.filter(o => o.status === 'completed');
    const failed = orders.filter(o => o.status === 'failed');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get support log count
    const allLogs = await Supabase.query('support_logs', { select: 'order_id' });
    const loggedOrderIds = new Set((allLogs || []).map(l => l.order_id));
    const supportTickets = orders.filter(o => loggedOrderIds.has(o._uuid));

    return {
      total: orders.length,
      completed: completed.length,
      failed: failed.length,
      pending: orders.filter(o => o.status === 'pending').length,
      revenue: completed.reduce((sum, o) => sum + o.amount, 0),
      todayOrders: completed.filter(o => new Date(o.completedAt) >= today).length,
      weekOrders: completed.filter(o => new Date(o.completedAt) >= weekAgo).length,
      monthOrders: completed.filter(o => new Date(o.completedAt) >= monthAgo).length,
      todayRevenue: completed.filter(o => new Date(o.completedAt) >= today).reduce((s, o) => s + o.amount, 0),
      weekRevenue: completed.filter(o => new Date(o.completedAt) >= weekAgo).reduce((s, o) => s + o.amount, 0),
      monthRevenue: completed.filter(o => new Date(o.completedAt) >= monthAgo).reduce((s, o) => s + o.amount, 0),
      supportRate: orders.length > 0 ? ((supportTickets.length / orders.length) * 100).toFixed(1) : 0,
      successRate: orders.length > 0 ? ((completed.length / orders.length) * 100).toFixed(1) : 0,
      mobileOrders: orders.filter(o => o.type === 'mobile').length,
      tvOrders: orders.filter(o => o.type === 'tv').length,
    };
  },

  // ── Revenue by day (last 7 days) ────────
  async getRevenueByDay(days = 7) {
    const orders = await this.getAllOrders();
    const completed = orders.filter(o => o.status === 'completed');
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOrders = completed.filter(o => o.completedAt && o.completedAt.startsWith(dateStr));
      result.push({
        date: dateStr,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        revenue: dayOrders.reduce((s, o) => s + o.amount, 0),
        count: dayOrders.length,
      });
    }
    return result;
  },

  // ── Export to CSV ─────────────────────────
  async exportCSV() {
    const orders = await this.getAllOrders();
    const headers = ['ID', 'Type', 'User', 'Amount', 'Status', 'PaymentRef', 'LoginLink', 'TVCode', 'CreatedAt', 'CompletedAt'];
    const rows = orders.map(o => [
      o.id, o.type, o.userId, o.amount, o.status, o.paymentRef,
      o.loginLink || '', o.tvCode || '', o.createdAt, o.completedAt || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netflix_orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Field Mapping: DB ↔ Frontend ─────────
  // Frontend uses order_code as "id" (display), _uuid stores the real UUID
  _toFrontendOrder(row) {
    if (!row) return null;
    return {
      id: row.order_code || row.id,   // Display ID (NFLX-ABC123)
      _uuid: row.id,                   // Real UUID for DB references
      type: row.type || 'mobile',
      userId: row.user_id || '',
      email: row.email || '',
      phone: row.phone || '',
      amount: row.amount || 0,
      status: row.status || 'pending',
      paymentRef: row.payment_ref || '',
      loginLink: row.login_link || '',
      nftoken: row.nftoken || '',
      cookieId: row.cookie_id || '',
      accountInfo: row.account_info,
      tvCode: row.tv_code || '',
      tvLoginStatus: row.tv_login_status || '',
      transactionId: row.transaction_id || '',
      transactionDate: row.transaction_date || '',
      refreshCount: row.refresh_count || 0,
      lastRefreshAt: row.last_refresh_at,
      supportLogs: [],
      createdAt: row.created_at,
      paidAt: row.paid_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
    };
  },

  _toDbOrder(updates) {
    const map = {
      type: 'type', userId: 'user_id', email: 'email', phone: 'phone',
      amount: 'amount', status: 'status', paymentRef: 'payment_ref',
      loginLink: 'login_link', nftoken: 'nftoken', cookieId: 'cookie_id',
      accountInfo: 'account_info', tvCode: 'tv_code', tvLoginStatus: 'tv_login_status',
      transactionId: 'transaction_id', transactionDate: 'transaction_date',
      refreshCount: 'refresh_count', lastRefreshAt: 'last_refresh_at',
      createdAt: 'created_at', paidAt: 'paid_at', completedAt: 'completed_at',
      expiresAt: 'expires_at',
    };
    const dbUpdates = {};
    for (const [key, val] of Object.entries(updates)) {
      const dbKey = map[key] || key;
      dbUpdates[dbKey] = val;
    }
    return dbUpdates;
  },
};
