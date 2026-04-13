// API hủy hóa đơn
// POST /api/invoice/cancel
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceCode, username } = body;

    if (!invoiceCode) {
      return NextResponse.json({ success: false, message: 'Thiếu mã hoá đơn' }, { status: 400 });
    }

    const invoice = await getInvoiceByCode(invoiceCode);
    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy hoá đơn' }, { status: 404 });
    }

    if (invoice.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `Không thể hủy: ${invoice.status}` }, { status: 400 });
    }

    if (username && invoice.username !== username) {
      return NextResponse.json({ success: false, message: 'Không có quyền hủy' }, { status: 403 });
    }

    await updateInvoice(invoiceCode, { status: 'CANCELLED' });

    return NextResponse.json({ success: true, message: 'Đã hủy hóa đơn thành công' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi hủy hoá đơn' }, { status: 500 });
  }
}
