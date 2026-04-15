-- ==============================================================================
-- NETFLIX PREMIUM STORE - Auth Email Guard
-- Chuẩn hóa email + chỉ cho phép @gmail.com khi tạo/cập nhật auth.users.
-- Yêu cầu: Chạy trong Supabase SQL Editor.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_allowed_email()
RETURNS TRIGGER AS $$
DECLARE
  normalized_email TEXT;
  local_part TEXT;
  domain_part TEXT;
BEGIN
  normalized_email := lower(trim(COALESCE(NEW.email, '')));
  IF normalized_email = '' THEN
    RAISE EXCEPTION 'Email không hợp lệ';
  END IF;

  NEW.email := normalized_email;

  -- Lấy phần chữ trước và sau dấu @
  local_part := split_part(normalized_email, '@', 1);
  domain_part := split_part(normalized_email, '@', 2);

  -- 1) Email phải có local-part và domain hợp lệ
  IF local_part = '' OR domain_part = '' THEN
    RAISE EXCEPTION 'Email không hợp lệ';
  END IF;

  -- 2) Chặn domain con của gmail.com
  IF domain_part LIKE '%.gmail.com' THEN
    RAISE LOG 'Blocked gmail subdomain signup: %', normalized_email;
    RAISE EXCEPTION 'Email thuộc subdomain của Gmail không được phép đăng ký.';
  END IF;

  -- 3) Chỉ chấp nhận domain @gmail.com
  IF domain_part <> 'gmail.com' THEN
    RAISE EXCEPTION 'Chỉ cho phép đăng ký bằng địa chỉ @gmail.com';
  END IF;

  -- 4) Gmail thuần: chỉ cho phép chữ và số trước @gmail.com
  IF NOT (local_part ~ '^[a-z0-9]+$') THEN
    RAISE LOG 'Blocked non-pure gmail local-part signup: %', normalized_email;
    RAISE EXCEPTION 'Email thuộc subdomain của Gmail không được phép đăng ký.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu đã tồn tại để tránh lỗi
DROP TRIGGER IF EXISTS trg_restrict_email_signup ON auth.users;

-- Thêm trigger cho auth.users
CREATE TRIGGER trg_restrict_email_signup
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_allowed_email();
