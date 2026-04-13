-- =============================================
-- NETFLIX PREMIUM STORE - Schema Migration
-- Chạy trong Supabase SQL Editor
-- =============================================

-- ── 1. Cập nhật bảng users ──────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE users SET display_name = username WHERE display_name IS NULL;

-- ── 2. Thêm cột vào bảng orders (đã tồn tại) ──
-- Bảng orders đã có id (uuid), thêm các cột cần thiết cho frontend
ALTER TABLE orders ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'mobile';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 20000;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS login_link TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nftoken TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cookie_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tv_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tv_login_status TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_date TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refresh_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- Thêm cột order_code (text) để frontend tham chiếu (VD: NFLX-ABC123)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code TEXT UNIQUE;

-- ── 3. Tạo bảng support_logs ────────────────
CREATE TABLE IF NOT EXISTS support_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Indexes ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders(payment_ref);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_support_logs_order_id ON support_logs(order_id);

-- ── 5. Verify ───────────────────────────────
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'orders', 'support_logs', 'invoices', 'balance_history', 'notifications')
ORDER BY table_name;
