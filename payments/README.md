# 🏦 HỆ THỐNG TỰ ĐỘNG DUYỆT NẠP TIỀN MB BANK

## Mô tả
Hệ thống tự động kiểm tra giao dịch MB Bank và cộng tiền cho user khi phát hiện chuyển khoản khớp. Hoạt động hoàn toàn tự động, không cần admin duyệt thủ công.

## Luồng hoạt động

```
User tạo hóa đơn → Hiển thị QR MBBank → User chuyển khoản
     ↓
Frontend poll mỗi 5s → POST /api/mbbank/check
     ↓
Server gọi MB Bank API → Lấy lịch sử giao dịch
     ↓
So khớp: số tiền + nội dung chuyển khoản
     ↓
Khớp → Cộng tiền user → Update invoice PAID → Gửi Telegram
```

## Cấu trúc thư mục

```
hung-payment/
├── lib/
│   ├── mbbank-web.ts          # Gọi MB Bank API lấy giao dịch
│   └── telegram-notify.ts     # Gửi thông báo Telegram
├── api/
│   ├── mbbank/check/route.ts  # Auto-check & cộng tiền
│   └── invoice/
│       ├── create/route.ts    # Tạo hóa đơn
│       ├── cancel/route.ts    # Hủy hóa đơn
│       └── status/route.ts    # Kiểm tra trạng thái
├── schema.sql                 # Tạo bảng trong Supabase
└── README.md                  # File này
```

## Environment Variables cần thiết

```env
# MB Bank credentials
MBBANK_USERNAME=your_mbbank_username
MBBANK_PASSWORD=your_mbbank_password
MBBANK_ACCOUNT=your_account_number
MBBANK_ACCOUNT_NAME=TEN_CHU_TAI_KHOAN

# API fallback (apicanhan.com)
APICANHAN_KEY=your_api_key

# MB Bank session (optional, cho direct API)
MBBANK_SESSION_ID=
MBBANK_TOKEN=
MBBANK_COOKIE=
MBBANK_DEVICEID=

# Telegram thông báo
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_IDS=chat_id_1,chat_id_2

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database (Supabase)

Chạy file `schema.sql` trong Supabase SQL Editor để tạo các bảng:
- `invoices` — hóa đơn nạp tiền
- `balance_history` — lịch sử giao dịch
- `notifications` — thông báo cho user
- Cần bảng `users` có sẵn với cột `balance` và `total_deposit`

## Các hàm DB cần implement

Hệ thống sử dụng các hàm sau — bạn cần implement trong `lib/db.ts`:

```typescript
// Hóa đơn
getInvoiceByCode(code: string) → invoice
createInvoice(data) → invoice
updateInvoice(code: string, updates) → invoice

// User
getUserByUsername(username: string) → user
updateUser(username: string, updates) → user

// Lịch sử
createBalanceHistory(data) → void
createNotification(data) → void
```

## Frontend (Trang nạp tiền)

Frontend cần:
1. **Tạo hóa đơn**: POST `/api/invoice/create` với `{ amount, username }`
2. **Hiển thị QR code**: Dùng VietQR API:
   ```
   https://img.vietqr.io/image/MB-{SỐ_TK}-compact.png?amount={SỐ_TIỀN}&addInfo={NỘI_DUNG}&accountName={TÊN}
   ```
3. **Auto-polling**: Mỗi 5 giây gọi POST `/api/mbbank/check` với `{ invoiceCode, amount, content }`
4. **Khi paid**: Reload trang để cập nhật số dư
5. **Hủy**: POST `/api/invoice/cancel` với `{ invoiceCode, username }`

---

## 🤖 PROMPT CHO ANTIGRAVITY ĐỂ TÍCH HỢP VÀO WEB KHÁC

Copy prompt dưới đây và gửi cho Antigravity kèm thư mục `hung-payment`:

---

### PROMPT:

```
Tôi cần tích hợp hệ thống tự động nạp tiền qua MB Bank vào web hiện tại. 
Toàn bộ code nguồn nằm trong thư mục `hung-payment/`. Hãy thực hiện:

1. **Tạo bảng database**: Chạy file `hung-payment/schema.sql` trong Supabase SQL Editor
   (hoặc tạo tương đương nếu dùng DB khác)

2. **Copy các lib vào project**:
   - `hung-payment/lib/mbbank-web.ts` → `src/lib/mbbank-web.ts`
   - `hung-payment/lib/telegram-notify.ts` → `src/lib/telegram-notify.ts`

3. **Tạo các API routes** (Next.js App Router):
   - `hung-payment/api/mbbank/check/route.ts` → `src/app/api/mbbank/check/route.ts`
   - `hung-payment/api/invoice/create/route.ts` → `src/app/api/invoice/create/route.ts`
   - `hung-payment/api/invoice/cancel/route.ts` → `src/app/api/invoice/cancel/route.ts`
   - `hung-payment/api/invoice/status/route.ts` → `src/app/api/invoice/status/route.ts`

4. **Implement các hàm DB** trong `src/lib/db.ts` (kết nối với Supabase):
   - getInvoiceByCode, createInvoice, updateInvoice
   - getUserByUsername, updateUser
   - createBalanceHistory, createNotification

5. **Tạo trang nạp tiền** (`src/app/deposit/page.tsx`):
   - Cho user nhập số tiền → tạo hóa đơn
   - Hiển thị QR code MB Bank (dùng VietQR API)
   - Auto-polling mỗi 5 giây gọi `/api/mbbank/check`
   - Khi phát hiện thanh toán → hiện thông báo + reload

6. **Thêm environment variables** (xem README.md trong hung-payment)

Luồng hoạt động:
- User tạo hóa đơn → hiển thị QR code MB Bank
- Frontend poll mỗi 5s POST /api/mbbank/check
- Backend gọi MB Bank API → lấy lịch sử giao dịch
- So khớp số tiền + nội dung chuyển khoản
- Nếu khớp → cộng tiền user → update hóa đơn PAID → gửi Telegram

Lưu ý quan trọng:
- Dùng rate limiting (15 req/phút) chống spam
- Dùng processingInvoices Set chống race condition
- Re-check invoice status trước khi cộng tiền (prevent double-credit)
- Dùng AbortController trong frontend để hủy request khi cancel invoice
```

---
