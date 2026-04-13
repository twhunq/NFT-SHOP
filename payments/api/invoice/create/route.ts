// API tạo hóa đơn nạp tiền
// POST /api/invoice/create
import { NextResponse } from 'next/server';

// ============================================
// THAY ĐỔI: import từ DB của bạn
// import { createInvoice } from '@/lib/db';
// ============================================

const bankConfig = {
  accountNumber: process.env.MBBANK_ACCOUNT || '',
  accountName: process.env.MBBANK_ACCOUNT_NAME || '',
  phoneNumber: process.env.MBBANK_PHONE || '',
  bankCode: 'MB',
  bankName: 'MB Bank',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, username, type } = body;

    if (!amount || amount < 1000) {
      return NextResponse.json({ success: false, message: 'Số tiền tối thiểu là 1.000 VND' });
    }

    const invoiceCode = `INV${Date.now()}`;
    const transferContent = `NAPTIEN ${invoiceCode}`;

    // TẠO HÓA ĐƠN TRONG DB CỦA BẠN
    const newInvoice = await createInvoice({
      code: invoiceCode,
      amount: parseInt(amount),
      payment_method: 'MB Bank',
      account_number: bankConfig.accountNumber,
      account_name: bankConfig.accountName,
      phone_number: bankConfig.phoneNumber,
      content: transferContent,
      username: username || 'guest',
      type: type || 'DEPOSIT',
      status: 'PENDING',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      invoice: {
        code: newInvoice.code,
        amount: newInvoice.amount,
        content: newInvoice.content,
        accountNumber: bankConfig.accountNumber,
        accountName: bankConfig.accountName,
        status: 'PENDING',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi tạo hoá đơn' }, { status: 500 });
  }
}
