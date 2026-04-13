// API kiểm tra trạng thái hóa đơn
// GET /api/invoice/status?code=INVxxx
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceCode = searchParams.get('code');

    if (!invoiceCode) {
      return NextResponse.json({ success: false, message: 'Thiếu mã hoá đơn' }, { status: 400 });
    }

    const invoice = await getInvoiceByCode(invoiceCode);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy hoá đơn' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoice: {
        code: invoice.code,
        status: invoice.status,
        amount: invoice.amount,
        content: invoice.content,
        type: invoice.type || 'DEPOSIT',
        paidAt: invoice.paid_at || null,
        createdAt: invoice.created_at,
        expiresAt: invoice.expires_at,
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
  }
}
