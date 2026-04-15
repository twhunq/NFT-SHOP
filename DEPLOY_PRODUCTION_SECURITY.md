# Production Deploy & Source Protection Guide

## Cảnh báo thực tế về "bảo mật tuyệt đối"
- Frontend web chạy trên trình duyệt không thể đạt bảo mật tuyệt đối 100%.
- Obfuscation chỉ tăng chi phí reverse engineering, không thay thế server-side security.
- Secret thật (service key, admin master secret) không được để trong frontend.

## 1) Chuẩn bị môi trường
1. Cài Node.js LTS.
2. Cài dependency:
```bash
npm install
```

## 2) Backup trước deploy
- Chạy backup snapshot toàn bộ source (trừ `node_modules`, `dist`, `backups`):
```bash
npm run backup:predeploy
```
- Backup được tạo tại thư mục `backups/snapshot-YYYYMMDD-HHMMSS`.

## 3) Build production + obfuscation
- Chạy pipeline:
```bash
npm run build:prod
```
- Hoặc chạy full:
```bash
npm run deploy:prepare
```

### Những gì pipeline đã làm
- Minify + obfuscate toàn bộ `js/*.js`.
- Xóa comment, drop `console.*`, drop `debugger`.
- Obfuscate inline script trong HTML.
- Minify HTML/CSS.
- Tạo artifact deploy trong `dist/`.

## 4) Bảo mật server / edge
- Dùng cấu hình mẫu NGINX:
  - `security/nginx-production.conf`
- Dùng checklist Cloudflare:
  - `security/cloudflare-production-checklist.md`

### Thành phần bảo mật đã bao phủ
- CSP headers.
- Secure headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, ...).
- HTTPS (TLS 1.2+), redirect HTTP -> HTTPS.
- Rate limiting baseline.
- WAF / DDoS guidance.
- Ẩn thông tin phiên bản server (`server_tokens off`).

## 5) Kiểm thử sau obfuscation
1. Mở toàn bộ flow chính:
   - login/register
   - claim mobile/tv
   - admin settings
   - history
2. Xác nhận không còn comment/debug log lộ logic nội bộ.
3. So sánh performance:
   - Lighthouse Performance
   - DevTools Performance (FCP/LCP/TTI)
4. Cross-browser:
   - Chrome, Firefox, Edge, Safari

## 6) Checklist Go-live
- [ ] Backup mới nhất đã tạo.
- [ ] `dist/` build thành công không lỗi.
- [ ] CSP không chặn nhầm domain cần thiết (Supabase/API/CDN).
- [ ] HTTPS A+ (SSL Labs mức tốt).
- [ ] WAF/rate limit đã bật.
- [ ] Monitoring/alerts đã cấu hình.

## 7) Khuyến nghị nâng cao (quan trọng)
- Chuyển logic nhạy cảm (admin auth thật, claim verification) sang backend API bảo vệ bằng JWT/session.
- Dùng Supabase RLS chặt hơn theo user role thay vì mở `USING (true)` cho mọi update.
- Tách môi trường staging/production và xoay vòng key định kỳ.
