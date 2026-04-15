-- ==============================================================================
-- NETFLIX PREMIUM STORE - Auth Email Guard
-- Chuan hoa email + validate dinh dang khi tao/cap nhat auth.users.
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

  -- 1) Email phai co local-part va domain hop le
  IF local_part = '' OR domain_part = '' THEN
    RAISE EXCEPTION 'Email khong hop le';
  END IF;

  -- 2) Local-part khong duoc bat dau/ket thuc bang "." va khong co ".."
  IF local_part LIKE '.%' OR local_part LIKE '%.' OR local_part LIKE '%..%' THEN
    RAISE EXCEPTION 'Phan ten email khong hop le';
  END IF;

  -- 3) Domain phai co dau "." va khong duoc bat dau/ket thuc bang "."
  IF domain_part NOT LIKE '%.%' OR domain_part LIKE '.%' OR domain_part LIKE '%.' OR domain_part LIKE '%..%' THEN
    RAISE EXCEPTION 'Ten mien email khong hop le';
  END IF;

  -- 4) Ky tu cho phep cho local/domain
  IF NOT (local_part ~ '^[a-z0-9._%+-]+$') THEN
    RAISE EXCEPTION 'Phan ten email chi duoc chua chu, so va ky tu hop le';
  END IF;
  IF NOT (domain_part ~ '^[a-z0-9.-]+$') THEN
    RAISE EXCEPTION 'Ten mien email chi duoc chua chu, so, dau cham va dau gach ngang';
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
