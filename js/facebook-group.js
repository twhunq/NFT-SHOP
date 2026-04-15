/**
 * ============================================
 *  NETFLIX PREMIUM – Facebook Group Button
 * ============================================
 */

const FacebookGroup = {
  validateUrl(input) {
    const raw = (input || '').trim();
    if (!raw) {
      return { ok: false, error: 'Vui lòng nhập link Nhóm Facebook' };
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;

    try {
      parsed = new URL(withProtocol);
    } catch {
      return { ok: false, error: 'Link không hợp lệ' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: 'Link phải bắt đầu bằng http:// hoặc https://' };
    }

    const host = parsed.hostname.toLowerCase();
    const isFacebookHost =
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com');

    if (!isFacebookHost) {
      return { ok: false, error: 'Chỉ chấp nhận link thuộc facebook.com hoặc fb.com' };
    }

    return { ok: true, normalizedUrl: parsed.toString() };
  },

  async getConfiguredUrl() {
    const raw = await DB.getFacebookGroupUrl();
    return (raw || '').trim();
  },

  openInNewTab(url) {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      throw new Error('Trình duyệt đang chặn mở tab mới. Vui lòng cho phép popup và thử lại.');
    }
  },

  async initHomeButton(buttonId = 'btn-facebook-group') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    try {
      const rawUrl = await this.getConfiguredUrl();
      if (!rawUrl) {
        btn.classList.add('hidden');
        return;
      }

      const validated = this.validateUrl(rawUrl);
      if (!validated.ok) {
        btn.classList.add('hidden');
        return;
      }

      btn.classList.remove('hidden');
      btn.href = validated.normalizedUrl;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';

      btn.addEventListener('click', (event) => {
        event.preventDefault();
        try {
          this.openInNewTab(validated.normalizedUrl);
        } catch (err) {
          Utils.toast(err.message, 'error');
        }
      });
    } catch (err) {
      console.error('[FacebookGroup] initHomeButton ERROR:', err);
      btn.classList.add('hidden');
    }
  },
};
