-- =============================================
-- FIX: Khôi phục đơn hàng bị timer ghi đè sai status
-- Đơn NFLX-UQD75K đã thanh toán + deliver thành công 
-- nhưng bị countdown timer ghi đè thành 'failed'
-- Chạy trong Supabase SQL Editor
-- =============================================

-- Khôi phục đơn đã completed bị ghi đè
-- Điều kiện: có paid_at, completed_at, login_link nhưng status = 'failed'
UPDATE orders 
SET status = 'completed'
WHERE order_code = 'NFLX-UQD75K'
  AND status = 'failed'
  AND paid_at IS NOT NULL 
  AND completed_at IS NOT NULL
  AND login_link IS NOT NULL 
  AND login_link != '';

-- Verify
SELECT order_code, status, paid_at, completed_at, expires_at
FROM orders 
WHERE order_code = 'NFLX-UQD75K';

-- Bonus: Tìm các đơn khác cũng bị lỗi tương tự
-- (có paid_at + completed_at nhưng status = 'failed')
SELECT order_code, user_id, status, paid_at, completed_at
FROM orders 
WHERE status = 'failed' 
  AND paid_at IS NOT NULL 
  AND completed_at IS NOT NULL;
