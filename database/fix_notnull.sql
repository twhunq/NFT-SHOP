-- Fix: Thêm default cho cột device_id và username
-- để không bị lỗi NOT NULL khi insert từ frontend
ALTER TABLE orders ALTER COLUMN device_id SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN username SET DEFAULT '';
