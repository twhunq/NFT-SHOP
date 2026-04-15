# Animation Guidelines & Reusable Library

## Mục tiêu
- Đảm bảo chuyển động mượt, rõ trạng thái, tăng UX nhưng không gây khó chịu.
- Tái sử dụng animation giữa các trang bằng thư viện chung.

## Thành phần đã triển khai
- CSS library: `css/shared.css` (section `Animation System Library`)
- JS library: `js/animations.js`

## Animation catalog
1. **Page transition**
- Class: `body.anim-page`, `anim-page--ready`, `anim-page--leaving`
- Thời gian: `300ms - 500ms` (đang dùng `400ms`)
- Property: `opacity`, `transform`

2. **Hover effects**
- Class: `.anim-hover-button`, `.anim-hover-card`
- Hiệu ứng: nâng nhẹ (`translateY`) + shadow transition
- Thời gian: `300ms`

3. **Loading skeleton**
- Class: `.anim-skeleton`, `.anim-skeleton-host`
- API: `data-skeleton`, `data-skeleton-count`, `data-skeleton-min-ms`
- Dùng cho section nặng dữ liệu (history/admin table)

4. **Parallax scrolling**
- Attribute: `data-parallax`, `data-parallax-speed`, `data-parallax-direction`
- Update qua `requestAnimationFrame` + `passive scroll`
- Property: `transform: translate3d(...)`

5. **Micro-interactions**
- Form field: `.anim-field`, `.anim-field--invalid`, `.anim-field--valid`
- User action click: `.anim-click-pop`

## Performance standards
- Chỉ animate `transform`, `opacity` để tận dụng GPU.
- Dùng `will-change` cho element cần animate.
- Tránh animate `top/left/width/height` trong runtime.
- Parallax update bằng rAF, không thao tác layout phức tạp trong scroll handler.

## Reduced motion fallback
- Tuân theo `@media (prefers-reduced-motion: reduce)`.
- Tắt animation/transition và parallax khi user bật reduced motion.

## Breakpoints
- Mobile: `<= 767px`
- Tablet: `768px - 1023px`
- Desktop: `>= 1024px`

## Cross-browser test matrix
- Chrome (latest)
- Firefox (latest)
- Safari (latest macOS/iOS)
- Edge (latest)

## 60fps verification checklist
1. Mở DevTools Performance (Chrome/Edge), record 10-15s khi scroll + hover.
2. FPS lane duy trì gần 60fps ở home hero và sections có parallax.
3. Không có long task > 50ms lặp lại liên tục trong interaction chính.
4. Test lại trên mobile thật (Android/iOS) với reduced-motion ON/OFF.

## Cách dùng nhanh cho tính năng mới
1. Gắn `js/animations.js` vào page.
2. Gắn class/attribute:
- Nút: `anim-hover-button`
- Card: `anim-hover-card`
- Skeleton host: `data-skeleton`
- Parallax: `data-parallax`
3. Với field bắt buộc: thêm `data-validate="required"`.

## Notes
- Thư viện hiện tại khởi tạo tự động qua `DOMContentLoaded`.
- Nếu cần disable animation cho module riêng, dùng `prefers-reduced-motion` hoặc không gắn attribute/class animation.
