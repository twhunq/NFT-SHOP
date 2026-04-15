# Cloudflare Production Security Checklist

## 1) DNS + SSL/TLS
- Bật `Proxied` (orange cloud) cho domain public.
- SSL/TLS mode: `Full (strict)`.
- Bật `Always Use HTTPS`.
- Bật `Automatic HTTPS Rewrites`.

## 2) WAF
- Bật Cloudflare Managed Ruleset.
- Bật OWASP Core Ruleset.
- Tạo custom WAF rule chặn request đáng ngờ:
  - High bot score
  - URI flood trong thời gian ngắn
  - Quốc gia/IP blacklist (nếu cần)

## 3) DDoS & Rate limiting
- Bật DDoS protection mặc định của Cloudflare.
- Tạo Rate Limiting Rules:
  - `/rest/v1/*` (Supabase proxy endpoint nếu có)
  - `/api/*` với limit phù hợp traffic thực tế
- Thiết lập action: `Managed Challenge` trước, `Block` sau khi xác nhận false-positive thấp.

## 4) Bot protection
- Bật Bot Fight Mode / Super Bot Fight Mode.
- Challenge với user-agent bất thường hoặc automation rõ ràng.

## 5) Security headers (nếu không set ở origin)
- Có thể dùng Cloudflare Transform Rules để inject:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`

## 6) Logging & Alerting
- Bật Security Events logging.
- Thiết lập cảnh báo khi spike 4xx/5xx hoặc challenge rate tăng bất thường.
