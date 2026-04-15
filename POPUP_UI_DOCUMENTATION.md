# Popup UI Improvement Documentation

## Phạm vi cập nhật
- Thay popup hệ thống (`window.prompt`) bằng popup custom cho luồng nhập mã nhận.
- Áp dụng thiết kế hiện đại theo bộ màu thương hiệu Netflix Premium.
- Chuẩn hóa class CSS theo BEM cho popup mới.

## File đã thay đổi
- `js/claim.js`
- `css/shared.css`

## Chi tiết thay đổi UI/UX
- **Màu thương hiệu**: dùng tông đỏ chủ đạo `#e50914` cho CTA và trạng thái focus.
- **Bo góc**: popup dùng `border-radius` linh hoạt `8px / 10px / 12px` theo breakpoint.
- **Đổ bóng**: popup dùng `box-shadow: 0 4px 20px rgba(0,0,0,0.15)`.
- **Typography hierarchy**:
  - Tiêu đề: `18px`, `font-weight: 700`.
  - Nội dung mô tả và nút: `14px`.
- **Padding đồng nhất**: vùng dialog popup dùng `padding: 24px`.
- **Icon minh họa**: thêm icon `key` ở header popup.
- **Animation mở/đóng**:
  - Overlay + dialog dùng `transition: 0.3s ease`.
  - Dialog có hiệu ứng translate/scale nhẹ khi mở.
- **Hành vi nhập mã**:
  - Tự động viết hoa trong ô input.
  - Nhấn `Enter` để xác nhận, `Esc` để hủy.
  - Hiển thị lỗi inline khi để trống.

## BEM class mới
- Block: `.claim-code-modal`
- Element:
  - `.claim-code-modal__overlay`
  - `.claim-code-modal__dialog`
  - `.claim-code-modal__header`
  - `.claim-code-modal__icon`
  - `.claim-code-modal__title`
  - `.claim-code-modal__desc`
  - `.claim-code-modal__input`
  - `.claim-code-modal__error`
  - `.claim-code-modal__actions`
  - `.claim-code-modal__btn`
- Modifier:
  - `.claim-code-modal--open`
  - `.claim-code-modal__btn--primary`
  - `.claim-code-modal__btn--secondary`

## Responsive breakpoints
- **Mobile**: `<= 767px`
  - Dialog full width, bo góc `8px`, 2 nút chiếm đều chiều ngang.
- **Tablet**: `768px - 1023px`
  - Dialog rộng tối đa `520px`, bo góc `10px`.
- **Desktop**: `>= 1024px`
  - Dialog rộng tối đa `560px`, bo góc `12px`.

## WCAG 2.1 AA (Contrast)
- Nền popup tối (`#1b1b1b`) + text sáng (`#fff7f6`, `#f6f6f6`) đảm bảo độ tương phản cao.
- CTA đỏ thương hiệu dùng chữ sáng để đạt readability tốt.
- Trạng thái focus có viền và ring rõ ràng (`box-shadow`) để hỗ trợ keyboard users.

## Cross-browser test checklist
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest on macOS/iOS)
- [ ] Edge (latest)

### Kịch bản test khuyến nghị
1. Mở popup khi bấm nhận gói có bật mã nhận.
2. Nhập mã đúng/sai/rỗng.
3. Đóng popup bằng `Esc`, click nền tối, nút `Hủy`.
4. Test responsive ở 3 breakpoint.
5. Kiểm tra animation open/close mượt trong từng browser.

## Screenshot before/after
- `Before`: ảnh popup native browser prompt (do user cung cấp).
- `After`: cần chụp popup custom mới sau khi deploy local.

Gợi ý lưu ảnh:
- `docs/screenshots/popup-before.png`
- `docs/screenshots/popup-after-mobile.png`
- `docs/screenshots/popup-after-tablet.png`
- `docs/screenshots/popup-after-desktop.png`
