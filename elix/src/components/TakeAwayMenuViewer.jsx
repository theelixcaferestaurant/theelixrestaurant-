import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import ContactButtons from './ContactButtons';
import MenuSearch from './MenuSearch';
import { searchTakeawayPages } from '../lib/takeawaySearch';
import { useTakeawayPages } from '../lib/takeaway';
import { MAX_SCALE, clampView, decideTurn, panView, pinchView, zoomAbout } from '../lib/menuGestures';
import '../styles/takeaway-viewer.css';

const TURN_MS = 200; // how long a page takes to slide away
const TAP_SLOP = 8; // movement (px) below which a touch still counts as a tap
const DOUBLE_TAP_MS = 400; // real double-taps are often slower than 300 ms
const DOUBLE_TAP_PX = 30;
const DOUBLE_TAP_SCALE = 2.5;
const BUTTON_STEP = 1.5;
const ZOOM_MS = 240;
const FIT = { s: 1, x: 0, y: 0 };

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const isZoomed = (v) => v.s > 1.001;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ms = (n) => (reduceMotion() ? 0 : n);

// The menu book. Gestures are read from Pointer Events, so one code path handles finger, pen and mouse.
//   zoom 1x:  horizontal swipe or drag turns the page; double-tap/click zooms; pinch or trackpad pinch zooms.
//   zoom >1x: one-finger or mouse drag moves the page; pinch zooms; double-tap/click returns to 1x.
//   two fingers: pinch only, never a page turn.
// The arrow buttons and arrow keys are alternatives and are never required.
export default function TakeAwayMenuViewer({ pages: pagesProp = null }) {
  // The public site passes nothing and shows the live pages; the dashboard preview passes its own list.
  const livePages = useTakeawayPages();
  const pages = pagesProp || livePages;
  const count = pages.length;
  const [index, setIndex] = useState(0);
  const [enter, setEnter] = useState(0); // +1 page came from the right, -1 from the left
  const [zoomed, setZoomed] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [full, setFull] = useState(false); // OPEN FULL MENU: the same viewer, shown full screen
  const viewerRef = useRef(null);
  const openRef = useRef(null);
  const closeRef = useRef(null);
  const focusOnToggle = useRef(false);

  const stageRef = useRef(null);
  const slideRef = useRef(null);
  const canvasRef = useRef(null);
  const indexRef = useRef(0);
  const view = useRef(FIT);
  const pendingTurn = useRef(null); // { next, dir } while a page is sliding away
  const turnTimer = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(null);
  const safariScale = useRef(1);

  const page = pages[Math.min(index, Math.max(count - 1, 0))];

  // Search bar: finds the menu pages (by section and by dish) and opens the one that is picked.
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchTakeawayPages(pages, query), [pages, query]);

  // Current frame size. H is the layout height of the fitted image (unaffected by the zoom transform).
  const frame = () => ({
    W: stageRef.current?.clientWidth ?? 0,
    H: canvasRef.current?.offsetHeight ?? 0,
  });
  const local = (event) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  // Writes the zoom and pan straight to the image, so a moving finger never waits for a re-render.
  const applyView = (animate) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { s, x, y } = view.current;
    canvas.style.transition = animate && ms(ZOOM_MS) ? `transform ${ZOOM_MS}ms ease-out` : 'none';
    canvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    setZoomed(isZoomed(view.current));
    setZoomPct(Math.round(s * 100));
  };

  // Moves the page sideways: follows the finger during a drag, and runs the page-turn slide.
  const slide = (x, animate) => {
    const el = slideRef.current;
    if (!el) return;
    el.style.transition = animate && ms(TURN_MS) ? `transform ${TURN_MS}ms ease-out` : 'none';
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  // Completes a page turn that is still sliding, so the new page is shown straight away.
  const finishTurn = () => {
    const p = pendingTurn.current;
    if (!p) return;
    clearTimeout(turnTimer.current);
    pendingTurn.current = null;
    indexRef.current = p.next;
    flushSync(() => {
      setIndex(p.next);
      setEnter(p.dir);
    });
    slide(0, false);
  };

  // Opens a page straight away (used by the search results), with the view reset to fit.
  const goTo = (target) => {
    finishTurn();
    if (target < 0 || target >= count) return;
    view.current = FIT;
    applyView(false);
    slide(0, false);
    indexRef.current = target;
    setEnter(0);
    setIndex(target);
    setQuery('');
    stageRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const canTurnTo = (dir) => indexRef.current + dir >= 0 && indexRef.current + dir < count;

  // Turns to the next (dir 1) or previous (dir -1) page. A turn already in progress is finished first,
  // so a quick second flick is never lost.
  const turn = (dir) => {
    finishTurn();
    if (!canTurnTo(dir)) {
      slide(0, true);
      return;
    }
    const next = indexRef.current + dir;
    view.current = FIT;
    applyView(false);
    const { W } = frame();
    slide(0, false);
    void slideRef.current?.offsetWidth; // commit the start position before the slide runs
    pendingTurn.current = { next, dir };
    slide(dir > 0 ? -W : W, true);
    turnTimer.current = setTimeout(finishTurn, ms(TURN_MS));
  };

  const openFull = () => {
    focusOnToggle.current = true;
    view.current = FIT;
    applyView(false);
    setFull(true);
  };

  const closeFull = () => {
    focusOnToggle.current = true;
    view.current = FIT;
    applyView(false);
    setFull(false);
  };

  // Moves focus into the full-screen menu on open, and back to the OPEN FULL MENU button on close.
  useEffect(() => {
    if (!focusOnToggle.current) return;
    focusOnToggle.current = false;
    if (full) {
      viewerRef.current?.scrollTo?.(0, 0);
      closeRef.current?.focus();
    } else {
      openRef.current?.focus();
    }
  }, [full]);

  const zoomBy = (factor) => {
    const { W, H } = frame();
    view.current = zoomAbout(view.current, view.current.s * factor, W / 2, H / 2, W, H);
    applyView(true);
  };

  const resetView = () => {
    view.current = FIT;
    applyView(true);
  };

  // Double-tap or double-click: zoom in around the point, or return to fit when already zoomed.
  const doubleTap = (p) => {
    if (isZoomed(view.current)) {
      view.current = FIT;
    } else {
      const { W, H } = frame();
      view.current = zoomAbout(view.current, DOUBLE_TAP_SCALE, p.x, p.y, W, H);
    }
    applyView(true);
  };

  const tap = (p) => {
    const now = performance.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < DOUBLE_TAP_MS && distance(prev, p) < DOUBLE_TAP_PX) {
      lastTap.current = null;
      doubleTap(p);
    } else {
      lastTap.current = { x: p.x, y: p.y, t: now };
    }
  };

  const onPointerDown = (event) => {
    finishTurn(); // a page still sliding is completed before the new touch starts
    void slideRef.current?.offsetWidth;
    if (pointers.current.size === 0) gesture.current = null;
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pts = [...pointers.current.values()];

    if (pts.length === 1) {
      gesture.current = {
        mode: isZoomed(view.current) ? 'pan' : 'swipe',
        start: p,
        startView: { ...view.current },
        t: performance.now(),
        moved: false,
        axis: null,
      };
    } else if (pts.length === 2) {
      // a second finger switches to pinch; the page does not turn
      slide(0, false);
      gesture.current = {
        mode: 'pinch',
        startDist: distance(pts[0], pts[1]),
        startMid: midpoint(pts[0], pts[1]),
        startView: { ...view.current },
        moved: true,
        axis: null,
      };
    }
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    const { W, H } = frame();
    const pts = [...pointers.current.values()];

    if (g.mode === 'pinch' && pts.length >= 2) {
      view.current = pinchView(g.startView, g.startMid, midpoint(pts[0], pts[1]), g.startDist, distance(pts[0], pts[1]), W, H);
      applyView(false);
      return;
    }
    if (pts.length !== 1) return;

    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;

    if (g.mode === 'pan') {
      view.current = panView(g.startView, dx, dy, W, H);
      applyView(false);
      return;
    }
    if (g.mode === 'swipe' && g.moved) {
      if (!g.axis) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'x') {
        // Follow the finger. At the first or last page the drag gives way, so it cannot run past the ends.
        const dir = dx < 0 ? 1 : -1;
        slide(canTurnTo(dir) ? dx : dx * 0.3, false);
      }
    }
  };

  // Ends a pointer's part in a gesture. Cancelled means the browser took the touch (for example to scroll).
  const finish = (event, cancelled) => {
    if (!pointers.current.has(event.pointerId)) return;
    const p = local(event);
    pointers.current.delete(event.pointerId);
    const g = gesture.current;

    if (pointers.current.size > 0) {
      // One finger lifted during a pinch: carry on with the other finger, without a jump.
      if (g && g.mode === 'pinch') {
        const [rest] = pointers.current.values();
        gesture.current = {
          mode: isZoomed(view.current) ? 'pan' : 'idle',
          start: rest,
          startView: { ...view.current },
          t: performance.now(),
          moved: true,
          axis: null,
        };
      }
      return;
    }

    gesture.current = null;
    if (!g) return;
    if (cancelled) {
      if (g.axis === 'x') slide(0, true);
      return;
    }
    if (g.mode === 'swipe' && g.axis === 'x') {
      const dx = p.x - g.start.x;
      const dir = decideTurn({ dx, dt: performance.now() - g.t, width: frame().W, canTurn: canTurnTo(dx < 0 ? 1 : -1) });
      if (dir) turn(dir);
      else slide(0, true);
      return;
    }
    if (!g.moved) {
      tap(p);
      return;
    }
    if ((g.mode === 'pinch' || g.mode === 'pan') && view.current.s < 1.05) resetView();
  };

  // Non-passive listeners on the menu only. They stop the browser from scrolling, navigating or zooming
  // the page during a horizontal swipe, a pinch or a drag while zoomed. Vertical scrolling elsewhere is unaffected.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;

    const onTouchMove = (event) => {
      const g = gesture.current;
      if (!g) return;
      const locked = pointers.current.size >= 2 || g.mode === 'pinch' || g.mode === 'pan' || (g.mode === 'swipe' && g.axis === 'x');
      if (locked && event.cancelable) event.preventDefault();
    };

    // Desktop trackpad pinch and Ctrl + scroll (Chrome, Edge, Firefox). Zooms around the pointer.
    const onWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const r = el.getBoundingClientRect();
      const { W, H } = frame();
      view.current = zoomAbout(view.current, view.current.s * Math.exp(-event.deltaY * 0.01), event.clientX - r.left, event.clientY - r.top, W, H);
      applyView(false);
    };

    // Safari on Mac sends its own trackpad pinch events. Two-finger touch pinch is handled by the pointer code above.
    const onGestureStart = (event) => {
      event.preventDefault();
      safariScale.current = view.current.s;
    };
    const onGestureChange = (event) => {
      event.preventDefault();
      if (pointers.current.size > 0) return;
      const r = el.getBoundingClientRect();
      const { W, H } = frame();
      const fx = Number.isFinite(event.clientX) ? event.clientX - r.left : W / 2;
      const fy = Number.isFinite(event.clientY) ? event.clientY - r.top : H / 2;
      view.current = zoomAbout(view.current, safariScale.current * event.scale, fx, fy, W, H);
      applyView(false);
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [count === 0]); // re-attach if the menu was empty and pages are added

  // Arrow keys turn the pages.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowRight') turn(1);
      if (event.key === 'ArrowLeft') turn(-1);
      if (event.key === 'Escape' && full) closeFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // If pages were removed in the dashboard while this menu is open, step back to the last page that still exists.
  useEffect(() => {
    if (count > 0 && index > count - 1) {
      indexRef.current = count - 1;
      setIndex(count - 1);
    }
  }, [count, index]);

  useEffect(() => () => clearTimeout(turnTimer.current), []);

  const controls = (
    <div className="tm-controls">
      <div className="tm-nav">
        <button type="button" className="tm-btn" onClick={() => turn(-1)} disabled={index === 0} aria-label="Previous page">
          <ChevronLeft size={20} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <p className="tm-count" aria-live="polite">
          Page {index + 1} of {count}
        </p>
        <button type="button" className="tm-btn" onClick={() => turn(1)} disabled={index === count - 1} aria-label="Next page">
          <span>Next</span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="tm-zoom" role="group" aria-label="Zoom">
        <button type="button" className="tm-btn" onClick={() => zoomBy(1 / BUTTON_STEP)} disabled={zoomPct <= 100} aria-label="Zoom out">
          <ZoomOut size={20} aria-hidden="true" />
        </button>
        <span className="tm-zoom-level" aria-live="polite">{zoomPct}%</span>
        <button
          type="button"
          className="tm-btn"
          onClick={() => zoomBy(BUTTON_STEP)}
          disabled={zoomPct >= MAX_SCALE * 100}
          aria-label="Zoom in"
        >
          <ZoomIn size={20} aria-hidden="true" />
        </button>
        <button type="button" className="tm-btn tm-fit" onClick={resetView} disabled={!zoomed}>
          Fit page
        </button>
      </div>
    </div>
  );

  if (count === 0 || !page) {
    return (
      <div className="tm-viewer">
        <h1 className="tm-sr-only">Take Away Menu</h1>
        <div className="takeaway-placeholder">
          <p className="takeaway-placeholder-title">Take Away menu coming soon</p>
          <p className="muted">Please contact us to place a Take Away order.</p>
        </div>
        <ContactButtons variant="menu" />
      </div>
    );
  }

  const enterClass = enter > 0 ? ' tm-enter-next' : enter < 0 ? ' tm-enter-prev' : '';

  return (
    <div
      ref={viewerRef}
      className={`tm-viewer${full ? ' is-full' : ''}`}
      role={full ? 'dialog' : undefined}
      aria-modal={full ? 'true' : undefined}
      aria-label={full ? 'Take Away Menu, full screen' : undefined}
    >
      <h1 className="tm-sr-only">Take Away Menu</h1>

      {full && (
        <div className="tm-full-bar">
          <button ref={closeRef} type="button" className="tm-btn tm-close" onClick={closeFull}>
            <X size={20} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      )}

      {!full && (
        <button ref={openRef} type="button" className="tm-open-full" onClick={openFull}>
          OPEN FULL MENU
        </button>
      )}

      {!full && (
        <div className="tm-search">
          <MenuSearch
            value={query}
            onChange={setQuery}
            placeholder="Search the menu, e.g. biryani, dosa, bakery"
            label="Search the Take Away menu"
            count={searching ? results.length : null}
          />
          {searching &&
            (results.length > 0 ? (
              <ul className="tm-results">
                {results.map((result) => (
                  <li key={result.index}>
                    <button type="button" className="tm-result" onClick={() => goTo(result.index)}>
                      <span className="tm-result-title">{result.page.title}</span>
                      <span className="tm-result-page">Page {result.index + 1}</span>
                      {result.dishes.length > 0 && (
                        <span className="tm-result-dishes">
                          {result.dishes.join(', ')}
                          {result.more > 0 ? ` and ${result.more} more` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tm-results-empty">No menu page matches “{query.trim()}”. Check the spelling or try another word.</p>
            ))}
        </div>
      )}

      {controls}
      <p className="tm-hint">Swipe to turn pages · Double-tap or pinch to zoom · Drag to move while zoomed</p>

      <div
        className="tm-stage"
        ref={stageRef}
        tabIndex={0}
        aria-label={`Menu page ${index + 1} of ${count}`}
        style={{ touchAction: zoomed ? 'none' : 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="tm-slide" ref={slideRef}>
          <div className="tm-canvas" ref={canvasRef}>
            <img
              key={page.src}
              className={`tm-page${enterClass}`}
              src={page.src}
              width={page.width}
              height={page.height}
              alt={`The Elix Take Away Menu, page ${index + 1} of ${count}: ${page.title}`}
              draggable={false}
              decoding="async"
            />
          </div>
        </div>
      </div>

      {controls}

      <p className="tm-open">
        <a href={page.src} target="_blank" rel="noopener noreferrer">
          Open this page at full size
        </a>
      </p>

      <ContactButtons variant="menu" />
    </div>
  );
}
