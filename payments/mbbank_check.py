"""
============================================
 MB Bank Auto-Check Payment Endpoint
 Add this to your Render server (nft-netflix.onrender.com)
============================================

Endpoint: POST /api/mbbank/check
Nhận: { invoiceCode, amount, content }
Trả: { success, paid, transactionId, transactionDate }

Cơ chế:
1. Gọi apicanhan.com lấy lịch sử giao dịch MB Bank
2. So khớp số tiền + nội dung chuyển khoản
3. Trả kết quả cho frontend

Environment Variables cần thiết:
  MBBANK_USERNAME=xxx
  MBBANK_PASSWORD=xxx
  MBBANK_ACCOUNT=xxx  (số tài khoản)
  APICANHAN_KEY=xxx
"""

import os
import time
import math
import requests
from flask import Blueprint, request, jsonify

mbbank_bp = Blueprint('mbbank', __name__)

# ── Rate Limiting ────────────────────────────
rate_limit_map = {}
RATE_LIMIT_WINDOW = 60  # 60 seconds
RATE_LIMIT_MAX = 15     # 15 requests per window
processing_invoices = set()

def check_rate_limit(key):
    now = time.time()
    entry = rate_limit_map.get(key)
    if not entry or now > entry['reset_time']:
        rate_limit_map[key] = {'count': 1, 'reset_time': now + RATE_LIMIT_WINDOW}
        return True
    if entry['count'] >= RATE_LIMIT_MAX:
        return False
    entry['count'] += 1
    return True

# ── Fetch MB Bank Transactions ───────────────
def fetch_mbbank_transactions():
    """
    Gọi apicanhan.com để lấy lịch sử giao dịch MB Bank.
    Adapted from payments/lib/mbbank-web.ts
    """
    api_key = os.environ.get('APICANHAN_KEY', '')
    username = os.environ.get('MBBANK_USERNAME', '')
    password = os.environ.get('MBBANK_PASSWORD', '')
    account_no = os.environ.get('MBBANK_ACCOUNT', '')

    if not all([api_key, username, password, account_no]):
        raise Exception('Missing MB Bank configuration')

    params = {
        'key': api_key,
        'username': username,
        'password': password,
        'accountNo': account_no,
    }

    try:
        resp = requests.get(
            'https://apicanhan.com/api/mbbankv3',
            params=params,
            headers={'accept': 'application/json'},
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get('status') == 'success' and data.get('transactions'):
            return data['transactions']
        raise Exception(data.get('message', 'Lỗi từ MB Bank API'))
    except requests.exceptions.RequestException as e:
        raise Exception(f'Không thể kết nối apicanhan.com: {str(e)}')


# ── Match Transaction ────────────────────────
def find_matching_transaction(transactions, amount, content):
    """
    So khớp giao dịch: số tiền gần đúng (±1000) + nội dung CK chứa mã đơn.
    Adapted from payments/api/mbbank/check/route.ts lines 130-138.
    """
    target_amount = int(amount)
    target_content = content.upper().strip()

    for tx in transactions:
        # Parse transaction amount
        tx_amount = abs(int(tx.get('amount', '0')))

        # Amount match (tolerance ±1000 VND)
        amount_match = abs(tx_amount - target_amount) <= 1000

        # Content match (description contains our reference code)
        tx_desc = (tx.get('description', '') or '').upper()
        content_match = target_content in tx_desc or tx_desc in target_content

        if amount_match and content_match:
            return {
                'transactionID': tx.get('transactionID', tx.get('refNo', '')),
                'amount': str(tx_amount),
                'description': tx.get('description', ''),
                'transactionDate': tx.get('transactionDate', ''),
            }

    return None


# ── API Endpoint ─────────────────────────────
@mbbank_bp.route('/api/mbbank/check', methods=['POST'])
def check_payment():
    """
    POST /api/mbbank/check
    Body: { invoiceCode: str, amount: int, content: str }
    """
    try:
        body = request.get_json(force=True)
        invoice_code = body.get('invoiceCode', '')
        amount = body.get('amount', 0)
        content = body.get('content', '')

        if not invoice_code:
            return jsonify({'success': False, 'message': 'Thiếu invoiceCode'}), 400

        # Rate limiting
        rate_key = f'mbbank_{invoice_code}'
        if not check_rate_limit(rate_key):
            return jsonify({'success': False, 'message': 'Quá nhiều yêu cầu. Đợi 1 phút.'}), 429

        # Prevent race condition
        if invoice_code in processing_invoices:
            return jsonify({'success': True, 'paid': False, 'message': 'Đang xử lý'})

        # Fetch transactions from MB Bank
        try:
            transactions = fetch_mbbank_transactions()
        except Exception as e:
            return jsonify({
                'success': False,
                'paid': False,
                'message': f'Lỗi kết nối MB Bank: {str(e)}'
            }), 500

        # Find matching transaction
        match = find_matching_transaction(transactions, amount, content)

        if match:
            processing_invoices.add(invoice_code)
            try:
                return jsonify({
                    'success': True,
                    'paid': True,
                    'transactionId': match['transactionID'],
                    'transactionDate': match['transactionDate'],
                    'amount': match['amount'],
                    'message': 'Đã phát hiện thanh toán!'
                })
            finally:
                # Remove after a delay to prevent double-processing
                # In production, use a proper lock mechanism
                processing_invoices.discard(invoice_code)

        return jsonify({
            'success': True,
            'paid': False,
            'message': 'Chưa phát hiện thanh toán'
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Lỗi server: {str(e)}'}), 500


# ──────────────────────────────────────────────
# HƯỚNG DẪN TÍCH HỢP VÀO RENDER SERVER
# ──────────────────────────────────────────────
#
# 1. Copy file này vào project Render server
#
# 2. Trong file server chính (app.py hoặc main.py), thêm:
#
#    from mbbank_check import mbbank_bp
#    app.register_blueprint(mbbank_bp)
#
# 3. Đảm bảo đã cài requests:
#    pip install requests
#
# 4. Thêm Environment Variables trên Render:
#    MBBANK_USERNAME=xxx
#    MBBANK_PASSWORD=xxx
#    MBBANK_ACCOUNT=xxx
#    APICANHAN_KEY=xxx
#
# 5. Deploy lại server
# ──────────────────────────────────────────────
