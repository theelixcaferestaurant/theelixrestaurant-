import { useEffect } from 'react';

// Scroll-triggered reveals for the public site: a soft fade plus a short slide-up, with a gentle
// stagger between siblings that appear together. Purely presentational:
//  - it only toggles CSS classes (.rv / .rv-in, see animations.css); it never changes content or layout
//  - it uses the `translate` property, so existing transforms (hovers, motion) are untouched
//  - the classes are removed again once an element has appeared, restoring its normal styles
//  - nothing runs when the visitor prefers reduced motion
// Food cards, gallery tiles and image panels already animate through motion/react, so they are skipped here.
const TARGETS = [
  '.page-hero .container > *',
  '.explore-head > *',
  '.welcome .container > *',
  '.split-text > *',
  '.section > .container > h2',
  '.section > .container > .section-head',
  '.section > .container > .lead',
  '.section-tight > .container > h2',
  '.pillar',
  '.review',
  '.reviews-layout > *',
  '.review-grid > *',
  '.reviews-empty',
  '.cat-card',
  '.choice-card',
  '.band-text > *',
  '.ambience-copy > *',
  '.contact-preview > *',
  '.contact-info > *',
  '.contact-form-wrap',
  '.map-embed',
  '.about-cta > *',
  '.mosaic-tile',
  '.menu-section-title',
  '.filter-row',
  '.timings-inner > *',
  '.timings-row',
  '.footer-grid > *',
  '.footer-demo',
].join(',');

// never touch overlays, navigation, admin controls or the take-away menu viewer
const SKIP = '.hero, .navbar, .drawer, .modal, .modal-backdrop, .lightbox, .search-overlay, .edit-bar, .tm-viewer, .tm-controls, .menu-search, .food-card, .food-row, .food-tile, .featured, [role="dialog"], .rv';

const STAGGER = 0.08; // seconds between siblings
const MAX_STEPS = 5;

export function useScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (!CSS.supports?.('translate', '0 1px')) return undefined;

    const timers = new Set();
    const tagged = new Set();

    const finish = (el) => {
      tagged.delete(el);
      el.classList.remove('rv', 'rv-in');
      el.style.removeProperty('--rv-delay');
    };

    const io = new IntersectionObserver(
      (entries) => {
        const counts = new Map();
        entries.forEach((entry) => {
          const el = entry.target;
          if (!entry.isIntersecting) {
            // already scrolled past (e.g. restored scroll position): show it without animation
            if (entry.boundingClientRect.top < 0) {
              io.unobserve(el);
              finish(el);
            }
            return;
          }
          io.unobserve(el);
          const n = counts.get(el.parentNode) || 0;
          counts.set(el.parentNode, n + 1);
          const delay = Math.min(n, MAX_STEPS) * STAGGER;
          el.style.setProperty('--rv-delay', `${delay}s`);
          // next frame so the hidden state is painted before the transition starts
          requestAnimationFrame(() => el.classList.add('rv-in'));
          const t = setTimeout(() => {
            timers.delete(t);
            finish(el);
          }, (delay + 0.9) * 1000 + 100);
          timers.add(t);
        });
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.01 }
    );

    const tag = (root) => {
      if (root.nodeType !== 1) return;
      const list = [];
      if (root.matches?.(TARGETS)) list.push(root);
      root.querySelectorAll?.(TARGETS).forEach((el) => list.push(el));
      list.forEach((el) => {
        if (el.dataset.rvDone === '1') return;
        if (el.closest(SKIP)) return;
        if (el.closest('.rv')) return;
        el.dataset.rvDone = '1';
        tagged.add(el);
        el.classList.add('rv');
        io.observe(el);
      });
    };

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => m.addedNodes.forEach(tag));
    });
    const root = document.getElementById('root') || document.body;
    mo.observe(root, { childList: true, subtree: true });
    tag(root);

    return () => {
      mo.disconnect();
      io.disconnect();
      timers.forEach(clearTimeout);
      tagged.forEach((el) => {
        el.classList.remove('rv', 'rv-in');
        el.style.removeProperty('--rv-delay');
        delete el.dataset.rvDone;
      });
      tagged.clear();
    };
  }, []);
}
