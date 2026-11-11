// Geometry for the menu book's zoom, pan and page-turn gestures (pure functions, no DOM).
// A view is { s, x, y }: s is the zoom (1 = fitted to the frame width), x and y are the image's offset in pixels.
// W is the frame width and H the fitted image height, both in pixels. Offsets are kept so the image never leaves the frame.

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Keeps the zoom in range and the image covering the frame (no gaps at the edges).
export function clampView(view, W, H) {
  const s = clamp(view.s, MIN_SCALE, MAX_SCALE);
  return { s, x: clamp(view.x, W - W * s, 0), y: clamp(view.y, H - H * s, 0) };
}

// Zooms to nextScale, keeping the point (fx, fy) of the frame fixed under the finger or cursor.
export function zoomAbout(view, nextScale, fx, fy, W, H) {
  const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const k = s / view.s;
  return clampView({ s, x: fx - (fx - view.x) * k, y: fy - (fy - view.y) * k }, W, H);
}

// Two-finger pinch: scale by the change in distance, and follow the midpoint so the pinch also moves the image.
export function pinchView(start, startMid, mid, startDist, dist, W, H) {
  if (startDist < 1) return clampView(start, W, H);
  const s = clamp(start.s * (dist / startDist), MIN_SCALE, MAX_SCALE);
  const px = (startMid.x - start.x) / start.s; // the image point that was under the fingers
  const py = (startMid.y - start.y) / start.s;
  return clampView({ s, x: mid.x - px * s, y: mid.y - py * s }, W, H);
}

// One-finger drag while zoomed.
export function panView(start, dx, dy, W, H) {
  return clampView({ s: start.s, x: start.x + dx, y: start.y + dy }, W, H);
}

// Decides whether a horizontal swipe turns the page. Returns 1 (next), -1 (previous) or 0 (snap back).
// A swipe needs to pass 20% of the width, or be a quick flick, so small movements never turn the page.
export function decideTurn({ dx, dt, width, canTurn }) {
  if (!canTurn || dx === 0) return 0;
  const distance = Math.abs(dx);
  const speed = dt > 0 ? distance / dt : 0; // pixels per millisecond
  const far = distance > width * 0.2;
  const quick = distance > 30 && speed > 0.4;
  if (!far && !quick) return 0;
  return dx < 0 ? 1 : -1;
}
