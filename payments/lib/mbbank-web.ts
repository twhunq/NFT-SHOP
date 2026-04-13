// Service để tự động login và lấy giao dịch từ MB Bank website
// https://online.mbbank.com.vn/

interface MBBankConfig {
  username: string;
  password: string;
  accountNo: string;
  apicanhanKey?: string;
  sessionId?: string;
  token?: string;
  cookie?: string;
  deviceid?: string;
}

interface MBBankTransaction {
  transactionID: string;
  amount: string;
  description: string;
  transactionDate: string;
  type: 'IN' | 'OUT';
}

const getMBBankConfig = (): MBBankConfig => {
  const username = process.env.MBBANK_USERNAME;
  const password = process.env.MBBANK_PASSWORD;
  const accountNo = process.env.MBBANK_ACCOUNT;
  const apicanhanKey = process.env.APICANHAN_KEY;

  if (!username || !password || !accountNo) {
    throw new Error('Missing required MB Bank configuration. Set MBBANK_USERNAME, MBBANK_PASSWORD, MBBANK_ACCOUNT env vars.');
  }

  return {
    username,
    password,
    accountNo,
    apicanhanKey: apicanhanKey || '',
    sessionId: process.env.MBBANK_SESSION_ID || '',
    token: process.env.MBBANK_TOKEN || '',
    cookie: process.env.MBBANK_COOKIE || '',
    deviceid: process.env.MBBANK_DEVICEID || ''
  };
};

export async function fetchMBBankTransactionsFromWeb(): Promise<MBBankTransaction[]> {
  const config = getMBBankConfig();

  try {
    if (config.cookie && config.sessionId) {
      try {
        const transactions = await fetchTransactionsWithSession(config);
        if (transactions && transactions.length > 0) return transactions;
      } catch (sessionError) {
        console.warn('[MB Bank] Session error, fallback to API:', sessionError);
      }
    }

    return await fetchTransactionsViaAPI(config);
  } catch (error) {
    try {
      return await fetchTransactionsViaAPI(config);
    } catch (fallbackError) {
      throw new Error('Không thể lấy giao dịch từ MB Bank');
    }
  }
}

async function fetchTransactionsWithSession(config: MBBankConfig): Promise<MBBankTransaction[]> {
  const endpoints = [
    'https://online.mbbank.com.vn/api/retail/transaction-account/so-tien-giao-dich',
    'https://online.mbbank.com.vn/api/retail/transaction-account/get',
    'https://online.mbbank.com.vn/api/retail/transaction/list'
  ];

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://online.mbbank.com.vn',
    'Referer': 'https://online.mbbank.com.vn/',
  };

  if (config.cookie) headers['Cookie'] = config.cookie;
  if (config.sessionId) { headers['X-Session-Id'] = config.sessionId; headers['sessionId'] = config.sessionId; }
  if (config.token) { headers['Authorization'] = `Bearer ${config.token}`; headers['token'] = config.token; }
  if (config.deviceid) { headers['deviceIdCommon'] = config.deviceid; headers['device-id'] = config.deviceid; }

  for (const url of endpoints) {
    try {
      const requestBody = {
        accountNo: config.accountNo,
        fromDate: getDateDaysAgo(30),
        toDate: getCurrentDate(),
        historyNumber: '',
        historyType: 'DATE_RANGE',
        refNo: '',
        sessionId: config.sessionId,
        deviceIdCommon: config.deviceid
      };

      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(requestBody) });
      if (!response.ok) continue;

      const data = await response.json();
      let transactions: any[] = [];

      if (data?.data && Array.isArray(data.data)) transactions = data.data;
      else if (Array.isArray(data)) transactions = data;
      else if (data?.transactions && Array.isArray(data.transactions)) transactions = data.transactions;
      else if (data?.result && Array.isArray(data.result)) transactions = data.result;

      if (transactions.length > 0) {
        return transactions.map((tx: any) => ({
          transactionID: tx.refNo || tx.transactionId || tx.id || '',
          amount: Math.abs(parseInt(tx.amount?.toString() || '0')).toString(),
          description: tx.description || tx.content || tx.remark || '',
          transactionDate: formatTransactionDate(tx.transactionDate || tx.date || tx.createdAt),
          type: (tx.amount >= 0 || tx.type === 'IN' || tx.direction === 'IN') ? 'IN' : 'OUT'
        }));
      }
    } catch { continue; }
  }

  throw new Error('Không thể lấy giao dịch từ bất kỳ endpoint nào');
}

async function fetchTransactionsViaAPI(config: MBBankConfig): Promise<MBBankTransaction[]> {
  const params = new URLSearchParams({
    key: config.apicanhanKey || '',
    username: config.username,
    password: config.password,
    accountNo: config.accountNo
  });

  const response = await fetch(`https://apicanhan.com/api/mbbankv3?${params.toString()}`, {
    method: 'GET',
    headers: { 'accept': 'application/json' }
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const data = await response.json();
  if (data.status === 'success' && data.transactions) return data.transactions;
  throw new Error(data.message || 'Lỗi từ MB Bank API');
}

function getCurrentDate(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatTransactionDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  try {
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  } catch { return dateStr; }
}
