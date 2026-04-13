-- =============================================
-- FIX RLS: Cho phép UPDATE orders (cần cho payment flow)
-- Chạy trong Supabase SQL Editor
-- =============================================

-- Xoá policy cũ đã chặn update
DROP POLICY IF EXISTS "Block anon updates" ON orders;
DROP POLICY IF EXISTS "Block anon deletes" ON orders;
DROP POLICY IF EXISTS "Block anon user updates" ON users;
DROP POLICY IF EXISTS "Block anon user deletes" ON users;
DROP POLICY IF EXISTS "Block support log updates" ON support_logs;

-- ── ORDERS: Cho phép update (payment flow cần), chặn delete ──
CREATE POLICY "Allow order updates" ON orders
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Block order deletes" ON orders
  FOR DELETE USING (false);

-- ── USERS: Cho phép update last_login, chặn delete ──
CREATE POLICY "Allow user updates" ON users
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Block user deletes" ON users
  FOR DELETE USING (false);

-- ── SUPPORT_LOGS: Chỉ đọc và thêm, không sửa/xoá ──
CREATE POLICY "Block support log updates" ON support_logs
  FOR UPDATE USING (false);

CREATE POLICY "Block support log deletes" ON support_logs
  FOR DELETE USING (false);

-- ── ẨN CỘT PASSWORD khỏi SELECT bằng View ──
-- Tạo view users_public để frontend dùng thay vì truy cập trực tiếp bảng users
CREATE OR REPLACE VIEW users_public AS
SELECT username, display_name, balance, total_deposit, last_login_at, created_at
FROM users;

-- Verify
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
