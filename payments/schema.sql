-- =============================================
-- BẢNG CẦN TẠO TRONG SUPABASE
-- Chạy trong SQL Editor
-- =============================================

-- Bảng invoices (hóa đơn nạp tiền)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'MB Bank',
  account_number TEXT,
  account_name TEXT,
  phone_number TEXT,
  content TEXT,               -- Nội dung chuyển khoản: "NAPTIEN INVxxx"
  username TEXT NOT NULL,
  product_name TEXT,
  product_id INTEGER,
  duration TEXT,
  plan TEXT,
  quantity INTEGER DEFAULT 1,
  type TEXT DEFAULT 'DEPOSIT', -- DEPOSIT hoặc PRODUCT_PURCHASE
  status TEXT DEFAULT 'PENDING', -- PENDING, PAID, CANCELLED, EXPIRED
  paid_at TIMESTAMPTZ,
  transaction_id TEXT,
  transaction_date TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng users (tối thiểu cần có)
-- Nếu đã có bảng users thì chỉ cần đảm bảo có các cột: balance, total_deposit
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deposit BIGINT DEFAULT 0;

-- Bảng balance_history (lịch sử giao dịch)
CREATE TABLE IF NOT EXISTS balance_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  previous_amount BIGINT DEFAULT 0,
  changed_amount BIGINT DEFAULT 0,
  current_amount BIGINT DEFAULT 0,
  content TEXT,
  type TEXT DEFAULT 'deposit',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng notifications (thông báo cho user)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_invoices_code ON invoices(code);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_username ON invoices(username);
CREATE INDEX IF NOT EXISTS idx_balance_history_username ON balance_history(username);
CREATE INDEX IF NOT EXISTS idx_notifications_username ON notifications(username);
