// Telegram Notification Service for Payment/Deposit
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').filter(Boolean);

const sendToAllAdmins = async (message: string): Promise<boolean> => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  let allSuccess = true;

  for (const adminId of TELEGRAM_ADMIN_IDS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text: message }),
      });
      const data = await response.json();
      if (!data.ok) allSuccess = false;
    } catch { allSuccess = false; }
  }
  return allSuccess;
};

interface DepositNotification {
  username: string;
  customerName?: string;
  amount: number;
  invoiceCode: string;
}

export const sendDepositNotification = async (deposit: DepositNotification): Promise<boolean> => {
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const message = `
💰 NẠP TIỀN MỚI!

👤 User: @${deposit.username}${deposit.customerName ? ` (${deposit.customerName})` : ''}
💵 Số tiền: ${deposit.amount.toLocaleString('vi-VN')}đ
📋 Hóa đơn: ${deposit.invoiceCode}
📅 ${dateStr} ⏰ ${timeStr}
    `.trim();

    return await sendToAllAdmins(message);
  } catch { return false; }
};
