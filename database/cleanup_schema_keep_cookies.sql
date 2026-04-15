-- =============================================
-- CLEANUP SCHEMA (KEEP COOKIES)
-- Mục tiêu:
-- 1) Xóa bảng không còn dùng trong code frontend hiện tại
-- 2) Chuẩn hóa bảng app_settings để lưu mã nhận toàn cục
-- 3) TUYỆT ĐỐI không đụng tới bảng public.cookies
-- =============================================

BEGIN;

-- -------------------------------------------------
-- 0) KHẲNG ĐỊNH KHÔNG XÓA COOKIES
-- -------------------------------------------------
-- Không có câu lệnh DROP/TRUNCATE/DELETE nào cho public.cookies.

-- -------------------------------------------------
-- 1) XÓA BẢNG THỪA (không dùng trong code hiện tại)
-- -------------------------------------------------
DROP TABLE IF EXISTS public.balance_history;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.notifications;

-- -------------------------------------------------
-- 2) APP SETTINGS (dùng cho mã nhận claim_code)
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value_text TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app_settings select" ON public.app_settings;
DROP POLICY IF EXISTS "Allow app_settings insert" ON public.app_settings;
DROP POLICY IF EXISTS "Allow app_settings update" ON public.app_settings;
DROP POLICY IF EXISTS "Block app_settings delete" ON public.app_settings;

CREATE POLICY "Allow app_settings select" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow app_settings insert" ON public.app_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow app_settings update" ON public.app_settings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Block app_settings delete" ON public.app_settings
  FOR DELETE USING (false);

INSERT INTO public.app_settings (key, value_text, updated_at)
VALUES ('claim_code', '', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text, updated_at)
VALUES ('announcement_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text, updated_at)
VALUES ('announcement_content', '', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text, updated_at)
VALUES ('facebook_group_url', '', now())
ON CONFLICT (key) DO NOTHING;

-- Ràng buộc key không rỗng (thêm nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_key_not_empty'
  ) THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_key_not_empty CHECK (length(trim(key)) > 0);
  END IF;
END $$;

-- -------------------------------------------------
-- 3) CHỈ MỤC HỮU ÍCH CHO HIỆU NĂNG
-- -------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_support_logs_order_id ON public.support_logs(order_id);

COMMIT;

-- -------------------------------------------------
-- 4) VERIFY NHANH SAU KHI CHẠY
-- -------------------------------------------------
-- SELECT to_regclass('public.cookies') AS cookies_table_should_exist;
-- SELECT to_regclass('public.app_settings') AS app_settings_should_exist;
-- SELECT key, value_text, updated_at FROM public.app_settings WHERE key = 'claim_code';
