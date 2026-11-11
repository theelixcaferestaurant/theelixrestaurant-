import { useEffect, useRef, useState } from 'react';
import { HERO_VIDEO } from '../data/siteData';
import { useIntroDone } from '../hooks/useIntro';
import { useContentVersion } from '../lib/content';
import ImagePanel from './ImagePanel';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Data-saver or a very slow connection: keep the photograph and skip downloading the clip.
const lowBandwidth = () => {
  if (typeof navigator === 'undefined') return false;
  const c = navigator.connection;
  return Boolean(c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')));
};

// Checks that a file really exists and really is the expected media type. Needed because many hosts
// (and the Vite dev server) answer a missing file with index.html and status 200, which a <video>
// element would otherwise try, and fail, to decode. A network / CORS failure is treated as "unknown"
// (the file may still play), so only a clear "not a video" answer rules a file out.
const probeCache = new Map();
async function isMedia(url, prefix) {
  if (!url) return false;
  const cacheKey = `${prefix}${url}`;
  if (probeCache.has(cacheKey)) return probeCache.get(cacheKey);
  const result = await probe(url, prefix);
  probeCache.set(cacheKey, result);
  return result;
}

async function probe(url, prefix) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    return type === '' || type.startsWith(prefix) || type === 'application/octet-stream';
  } catch {
    return true;
  }
}

// The hero's main food visual as a cinematic, borderless video: no player box, no controls.
// Layers (all in the same frame, so nothing ever shifts):
//   1. the hero photograph (or its labelled demo panel), always present underneath,
//   2. the food video, which fades in over it once it can play,
//   3. warm light, vignette and light sweep (CSS only) so the edges dissolve into the page.
// One <video> element only. It autoplays muted (required by browsers), loops, starts after the logo intro
// has finished, and pauses while off-screen or in a hidden tab. If the clip is missing or cannot play,
// the photograph simply stays: no broken player, no empty box.
export default function HeroVideo({ className = '' }) {
  useContentVersion(); // the dashboard can replace the hero clip
  const videoRef = useRef(null);
  const [src, setSrc] = useState(null); // verified video URL, or null
  const [poster, setPoster] = useState(null);
  const [ready, setReady] = useState(false);
  const [reduced] = useState(() => prefersReducedMotion() || lowBandwidth());
  const introDone = useIntroDone();
  const sig = `${HERO_VIDEO.mp4}|${HERO_VIDEO.webm}|${HERO_VIDEO.poster}`;

  // Pick the first source that really exists (MP4 first, WebM as the alternative).
  useEffect(() => {
    if (reduced) return undefined;
    let cancelled = false;
    setReady(false);
    (async () => {
      let chosen = null;
      for (const url of [HERO_VIDEO.mp4, HERO_VIDEO.webm]) {
        if (await isMedia(url, 'video/')) {
          chosen = url;
          break;
        }
      }
      const posterOk = chosen && HERO_VIDEO.poster ? await isMedia(HERO_VIDEO.poster, 'image/') : false;
      if (cancelled) return;
      setSrc(chosen);
      setPoster(posterOk ? HERO_VIDEO.poster : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sig, reduced]);

  // Play (muted, looping) only while visible, and only after the logo intro.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || reduced || !introDone) return undefined;
    video.muted = true;
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden) video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.1 }
    );
    observer.observe(video);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [src, reduced, introDone]);

  return (
    <div className={`hero-film ${ready ? 'is-ready' : ''} ${className}`}>
      <div className="hero-film-stage">
        <ImagePanel imageKey="hero-main" label="The Elix" tone="food" ratio="3 / 4" className="hero-film-fallback" eager />
        {src && !reduced && (
          <video
            key={src}
            ref={videoRef}
            className="hero-film-video"
            src={src}
            poster={poster || undefined}
            muted
            loop
            playsInline
            preload={introDone ? 'auto' : 'metadata'}
            disablePictureInPicture
            controls={false}
            tabIndex={-1}
            aria-hidden="true"
            onLoadedData={() => setReady(true)}
            onError={() => {
              setSrc(null);
              setReady(false);
            }}
          />
        )}
      </div>
      <span className="hero-film-light" aria-hidden="true" />
      <span className="hero-film-vignette" aria-hidden="true" />
      <span className="hero-film-sweep" aria-hidden="true" />
    </div>
  );
}
