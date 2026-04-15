/**
 * ============================================
 *  NETFLIX PREMIUM – Animation System
 *  Reusable animation library
 * ============================================
 */

const AnimationSystem = {
  _reducedMotion: false,
  _parallaxItems: [],
  _parallaxTicking: false,

  init() {
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.initPageTransition();
    this.initHoverEffects();
    this.initParallax();
    this.initMicroInteractions();
    this.initSkeletons();
  },

  initPageTransition() {
    document.body.classList.add('anim-page');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('anim-page--ready');
      });
    });

    if (this._reducedMotion) return;

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (/^https?:\/\//i.test(href) && !href.includes(location.host)) return;

      event.preventDefault();
      document.body.classList.add('anim-page--leaving');
      setTimeout(() => {
        location.href = href;
      }, 320);
    });
  },

  initHoverEffects() {
    const buttonSelectors = 'button, .btn, [role="button"], a.inline-flex, a[class*="bg-"]';
    const cardSelectors = '.package-card, .bg-surface-container-low, .bg-surface-container, .modal-content';

    document.querySelectorAll(buttonSelectors).forEach((el) => {
      el.classList.add('anim-hover-button');
      el.addEventListener('click', () => {
        el.classList.remove('anim-click-pop');
        requestAnimationFrame(() => el.classList.add('anim-click-pop'));
      });
    });

    document.querySelectorAll(cardSelectors).forEach((el) => {
      el.classList.add('anim-hover-card');
    });
  },

  initParallax() {
    if (this._reducedMotion) return;

    this._parallaxItems = Array.from(document.querySelectorAll('[data-parallax]'));
    if (this._parallaxItems.length === 0) return;

    const update = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      this._parallaxItems.forEach((el) => {
        const speed = Number(el.dataset.parallaxSpeed || 0.12);
        const direction = el.dataset.parallaxDirection === 'up' ? -1 : 1;
        const y = scrollY * speed * direction;
        el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      });
      this._parallaxTicking = false;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (!this._parallaxTicking) {
          this._parallaxTicking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  },

  initMicroInteractions() {
    const fields = document.querySelectorAll('input, textarea, select');
    fields.forEach((field) => {
      field.classList.add('anim-field');

      const validate = () => {
        const value = (field.value || '').trim();
        const isRequired = field.hasAttribute('required') || field.dataset.validate === 'required';
        if (!isRequired) return;

        if (!value) {
          field.classList.add('anim-field--invalid');
          field.classList.remove('anim-field--valid');
          return;
        }
        field.classList.remove('anim-field--invalid');
        field.classList.add('anim-field--valid');
      };

      field.addEventListener('blur', validate);
      field.addEventListener('input', () => {
        field.classList.remove('anim-field--invalid');
      });
    });
  },

  initSkeletons() {
    const hosts = document.querySelectorAll('[data-skeleton]');
    hosts.forEach((host) => {
      const count = Number(host.dataset.skeletonCount || 4);
      const minMs = Number(host.dataset.skeletonMinMs || 500);
      this.showSkeleton(host, count, minMs);
    });
  },

  showSkeleton(host, count = 4, minMs = 500) {
    if (!host || this._reducedMotion) return;

    host.classList.add('anim-skeleton-host', 'anim-skeleton-host--loading');
    const layer = document.createElement('div');
    layer.className = 'anim-skeleton-host__layer';

    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'anim-skeleton';
      item.style.height = i === 0 ? '32px' : '20px';
      layer.appendChild(item);
    }

    host.appendChild(layer);

    setTimeout(() => {
      host.classList.remove('anim-skeleton-host--loading');
      layer.remove();
    }, minMs);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  AnimationSystem.init();
});
