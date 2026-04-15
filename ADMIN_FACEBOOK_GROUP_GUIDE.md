# Hướng Dẫn Admin: Nút "Nhóm Facebook"

## Mục tiêu
- Thêm và quản lý link cho nút **Nhóm Facebook** hiển thị cạnh nút **Nhận ngay** ở trang chủ.

## Vị trí cài đặt
- Vào trang `admin.html`.
- Mở mục **Nút Nhóm Facebook**.

## Cách sử dụng
1. Nhập URL nhóm Facebook vào ô `facebook-group-url`.
2. Bấm **Lưu link**.
3. Nếu hợp lệ, hệ thống lưu vào `app_settings.facebook_group_url`.
4. Nút **Nhóm Facebook** sẽ hiện ở trang chủ và mở tab mới khi click.

## Validation URL
- Chấp nhận:
  - `https://www.facebook.com/...`
  - `https://facebook.com/...`
  - `https://fb.com/...`
- Nếu thiếu protocol, hệ thống tự thêm `https://`.
- Domain khác Facebook sẽ bị từ chối.

## Xóa link
- Bấm **Xóa link** để ẩn nút ở trang chủ.

## Lưu trữ dữ liệu
- Bảng: `app_settings`
- Key: `facebook_group_url`

## Lưu ý vận hành
- Link mở bằng tab mới (`_blank`) với `noopener noreferrer`.
- Nếu trình duyệt chặn popup/tab, user sẽ nhận thông báo lỗi.
