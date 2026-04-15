# Email OTP Only Migration Guide (@gmail.com)

## 1) Phương thức đăng nhập cũ đã loại bỏ
- Username/Password trong `Auth.login()` và `Auth.register()`.
- Form đăng ký/đăng nhập truyền thống trong popup.

## 2) Phương thức duy nhất còn hỗ trợ
- `Đăng nhập bằng Email OTP` qua Supabase Auth.
- Chỉ cho phép email `@gmail.com`.
- Không cho phép alias/submail dạng `+abc@gmail.com`.

## 3) Cấu hình Supabase Email Auth bắt buộc
1. Vào Supabase Dashboard.
2. `Authentication` -> `Providers` -> bật `Email`.
3. Tắt `Confirm email` nếu muốn vào ngay sau click OTP (hoặc giữ bật theo policy).
4. Trong `URL Configuration`, thêm redirect:
   - `https://your-domain/home.html`
   - Local dev: `http://127.0.0.1:5500/home.html`

## 4) Cập nhật database schema
- Chạy file:
  - `database/add_google_oauth_auth.sql`
- File này thêm:
  - `google_id`
  - `email`
  - `avatar_url`
  - `auth_provider`
  - unique index và update `users_public` view

## 5) Error handling đã có
- Callback thiếu token.
- Email domain không phải Gmail.
- Gmail alias `+` bị từ chối.
- Token hết hạn hoặc không hợp lệ.
- Popup đăng nhập hiển thị toast lỗi rõ ràng.

## 6) Backward compatibility
- User cũ vẫn giữ dữ liệu trong `users`.
- Migration gán `auth_provider='legacy'` cho bản ghi cũ.
- Khi user đăng nhập Google, hệ thống map theo `email` -> `username` để duy trì luồng cũ.

## 7) Kiểm thử
- Unit + integration tests:
```bash
npm test
```
- Manual regression:
1. Gửi OTP tới Gmail hợp lệ thành công.
2. Logout/Login lại.
3. Mua gói và xem lịch sử đơn.
4. Kiểm tra admin flow không vỡ.

## 8) Deploy staging
1. Deploy code lên staging.
2. Chạy `database/add_google_oauth_auth.sql` trên staging DB.
3. Cấu hình Supabase redirect URI đúng staging domain.
4. Chạy regression checklist trước khi promote production.
