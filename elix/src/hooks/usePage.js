import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_THEME } from '../themes/themeConfig';

// Sets a meaningful document title for each route.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

// Applies a category's complete colour identity to the whole site by setting data-theme on <html>.
// The CSS transitions on colours make the change smooth (about 400ms).
export function useCategoryTheme(key) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = key;
    return () => {
      document.documentElement.dataset.theme = DEFAULT_THEME;
    };
  }, [key]);
}

// Detail-modal state for a category page. Also opens an item directly when the URL contains
// ?item=<id>, which is how search results link to a specific dish.
export function useItemModal(items) {
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState(null);
  const wanted = params.get('item');

  useEffect(() => {
    if (!wanted) return;
    const found = items.find((item) => item.id === wanted);
    if (found) setActive(found);
  }, [wanted, items]);

  const close = () => {
    setActive(null);
    if (params.get('item')) {
      const next = new URLSearchParams(params);
      next.delete('item');
      setParams(next, { replace: true });
    }
  };

  return [active, setActive, close];
}

// Keeps keyboard focus inside a dialog, closes it on Escape, locks page scroll while open,
// and returns focus to the element that opened it. Mark an element with data-autofocus
// to choose which control receives focus first.
export function useFocusTrap(ref, active, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const node = ref.current;
    const previous = document.activeElement;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const target = node.querySelector('[data-autofocus]') || node.querySelector(selector) || node;
    target.focus({ preventScroll: true });

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = Array.from(node.querySelectorAll(selector));
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
