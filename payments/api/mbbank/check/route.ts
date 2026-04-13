// API kiểm tra giao dịch MB Bank và tự động duyệt nạp tiền
// POST /api/mbbank/check
import { NextResponse } from 'next/server';
import { sendDepositNotification } from '@/lib/telegram-notify';
import { fetchMBBankTransactionsFromWeb } from '@/lib/mbbank-web';

// ============================================
// CÁC HÀM NÀY CẦN THAY THẾ BẰNG DB CỦA BẠN
// ============================================
// import { getInvoiceByCode, updateInvoice, getUserByUsername, updateUser, createBalanceHistory, createNotification } from '@/lib/db';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const processingInvoices = new Set<string>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) rateLimitMap.delete(key);
  }
}, 300_000);

// Hàm xử lý cộng tiền - THAY ĐỔI THEO DB CỦA BẠN
async function processDeposit(invoice: any, transaction: any) {
  // 1. Tìm user
  const user = await getUserByUsername(invoice.username);
  if (!user) throw new Error(`User "${invoice.username}" không tồn tại`);

  // 2. Tính toán số dư
  const depositAmount = Number(invoice.amount);
  const previousBalance = Number(user.balance) || 0;
  const newBalance = previousBalance + depositAmount;
  const newTotalDeposit = (Number(user.total_deposit) || 0) + depositAmount;

  // 3. Cập nhật user
  await updateUser(invoice.username, { balance: newBalance, total_deposit: newTotalDeposit });

  // 4. Cập nhật invoice
  await updateInvoice(invoice.code, {
    status: 'PAID',
    paid_at: new Date().toISOString(),
    transaction_id: transaction.transactionID,
    transaction_date: transaction.transactionDate,
  });

  // 5. Ghi log
  try {
    await createBalanceHistory({
      username: invoice.username,
      previous_amount: previousBalance,
      changed_amount: depositAmount,
      current_amount: newBalance,
      content: `Nạp tiền thành công - Hóa đơn #${invoice.code}`,
      type: 'deposit',
    });
  } catch (e) { console.error('Error logging balance history:', e); }

  // 6. Thông báo
  try {
    await createNotification({
      username: invoice.username,
      type: 'success',
      title: 'Nạp tiền thành công',
      message: `Bạn đã nạp ${depositAmount.toLocaleString()}đ vào tài khoản`,
      is_read: false,
    });
  } catch (e) {}

  // 7. Telegram
  sendDepositNotification({
    username: invoice.username,
    customerName: user.full_name || undefined,
    amount: depositAmount,
    invoiceCode: invoice.code
  }).catch(err => console.error('Telegram error:', err));

  return { success: true, user: { username: invoice.username, balance: newBalance }, invoice: { ...invoice, status: 'PAID' } };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceCode, amount, content } = body;

    // Rate limiting
    const rateLimitKey = `mbbank_${invoiceCode || 'unknown'}`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({ success: false, message: 'Quá nhiều yêu cầu. Đợi 1 phút.' }, { status: 429 });
    }

    // Parse invoice code
    let invoiceCodeToUse = invoiceCode;
    if (!invoiceCodeToUse && content) {
      const match = content.match(/NAPTIEN\s+(INV\d+)/i);
      if (match) invoiceCodeToUse = match[1];
    }
    if (!invoiceCodeToUse) {
      return NextResponse.json({ success: false, message: 'Thiếu invoiceCode' }, { status: 400 });
    }

    // Tìm invoice PENDING
    const invoice = await getInvoiceByCode(invoiceCodeToUse);
    if (!invoice || invoice.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: 'Không tìm thấy hóa đơn hoặc đã xử lý' }, { status: 404 });
    }

    // Gọi MB Bank API
    let transactions;
    try {
      transactions = await fetchMBBankTransactionsFromWeb();
    } catch (error) {
      return NextResponse.json({ success: false, message: 'Không thể kết nối MB Bank API' }, { status: 500 });
    }

    // Tìm giao dịch khớp
    const matchingTransaction = transactions.find((t: any) => {
      const tAmount = parseInt(t.amount || '0');
      const invoiceAmount = Number(invoice.amount);
      const isAmountMatch = Math.abs(tAmount - invoiceAmount) <= 1000;
      const tDescription = (t.description || '').toString().toUpperCase();
      const invoiceContent = (invoice.content || '').toString().toUpperCase();
      const isContentMatch = tDescription.includes(invoiceContent) || invoiceContent.includes(tDescription);
      return isAmountMatch && isContentMatch;
    });

    if (matchingTransaction) {
      // Prevent race condition
      if (processingInvoices.has(invoiceCodeToUse)) {
        return NextResponse.json({ success: true, paid: false, message: 'Đang xử lý, đợi' });
      }
      processingInvoices.add(invoiceCodeToUse);

      // Re-check invoice status
      const freshInvoice = await getInvoiceByCode(invoiceCodeToUse);
      if (!freshInvoice || freshInvoice.status === 'PAID') {
        processingInvoices.delete(invoiceCodeToUse);
        return NextResponse.json({ success: true, paid: true, message: 'Đã xử lý', alreadyProcessed: true });
      }

      try {
        const result = await processDeposit(invoice, matchingTransaction);
        processingInvoices.delete(invoiceCodeToUse);
        return NextResponse.json({ success: true, paid: true, balance: result.user.balance, invoice: result.invoice });
      } catch (error) {
        processingInvoices.delete(invoiceCodeToUse);
        return NextResponse.json({ success: false, message: 'Lỗi cộng tiền' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, paid: false, message: 'Chưa phát hiện thanh toán' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
  }
}
