-- =============================================
-- FIX: Cho phép các cột gốc của bảng orders nhận NULL
-- hoặc thêm default value cho chúng.
-- Chạy trong Supabase SQL Editor
-- =============================================

-- Xem cấu trúc thực tế của bảng orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;
