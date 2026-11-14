import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getImage } from '../data/images';
import { getVideo } from '../data/videos';
import { isContentSettled, useContentVersion } from '../lib/content';
import { isSupabaseConfigured } from '../lib/supabase';
import { useLocalMediaVersion } from '../lib/localMedia';
import MediaEditor from './MediaEditor';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const saveDataOn = () => typeof navigator !== 'undefined' && navigator.connection?.saveData === true;

// Shows a real photograph when one exists for imageKey (see src/data/images.js).
// Otherwise, or if the file fails to load, it shows a styled, clearly labelled demo panel,
// so there is never an empty or broken image space.
//
// Optional food clip (videoKey = menu item id, see src/data/videos.js):
// - videoMode="hover" (default): a mouse over the image crossfades to the clip in the exact same area;
//   leaving crossfades back to the photograph. Touch screens never hover, so nothing happens on them
//   (the item's detail view uses videoMode="auto" instead).
// - videoMode="auto": the clip plays as soon as the image is shown; a tap pauses / resumes it.
// The <video> element is only created on first use, so no clip is downloaded until needed.
export default function ImagePanel({
  imageKey,
  label,
  tone = 'home',
  ratio = '4 / 5',
  className = '',
  alt,
  reveal = false,
  eager = false,
  videoKey: videoKeyProp,
  videoMode = 'hover',
  editable = true,
  forceEdit = false,
}) {
  useContentVersion(); // re-render when the dashboard changes a photo or clip
  useLocalMediaVersion(); // re-render when a photo or clip is added from the device
  const src = imageKey ? getImage(imageKey) : null;
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // transient network errors are retried before the demo panel is shown
  const [loadedSrc, setLoadedSrc] = useState(null); // the address that has fully loaded
  const [revealForced, setRevealForced] = useState(false);
  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [src]);
  const showPhoto = Boolean(src) && !failed;
  const loaded = showPhoto && loadedSrc === src;
  // Photographs come from the database. Until it has answered, an empty slot is a neutral loading state, never the
  // "Demo image" label (which would flash on every first visit) and never an invisible gap.
  const waiting = !src && isSupabaseConfigured && !isContentSettled();

  // A cached image can finish before React attaches onLoad: check it directly. If the browser is still holding a lazy
  // image back (for example inside a hidden / clipped reveal frame) after a moment, force it to load now.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !showPhoto) return undefined;
    if (el.complete && el.naturalWidth > 0) {
      setLoadedSrc(src);
      return undefined;
    }
    const t = setTimeout(() => {
      if (el.isConnected && !(el.complete && el.naturalWidth > 0)) {
        el.loading = 'eager';
        el.setAttribute('fetchpriority', 'high');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [src, attempt, showPhoto]);

  const onImgError = () => {
    if (attempt < 2) {
      setTimeout(() => setAttempt((n) => n + 1), 700 * (attempt + 1));
      return;
    }
    setFailed(true);
  };

  // Every slot can hold a clip: by default it is named after the image key (pass videoKey={null} for none).
  const videoKey = videoKeyProp === undefined ? (Array.isArray(imageKey) ? imageKey : imageKey || null) : videoKeyProp;
  const clip = videoKey ? getVideo(videoKey) : null;
  const clipSig = clip ? `${clip.mp4 || ''}${clip.webm || ''}` : '';
  const canVideo = Boolean(clip) && !prefersReducedMotion() && !saveDataOn();
  const videoRef = useRef(null);
  const resetTimer = useRef(null);
  const [armed, setArmed] = useState(false); // <video> element created
  const [active, setActive] = useState(false); // clip visible
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => setVideoFailed(false), [clipSig]);

  const start = () => {
    clearTimeout(resetTimer.current);
    setArmed(true);
    setActive(true);
    const video = videoRef.current;
    if (video) video.play().catch(() => {});
  };

  const stop = () => {
    setActive(false);
    clearTimeout(resetTimer.current);
    // wait for the crossfade to finish, then rewind so the next hover starts from the beginning
    resetTimer.current = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }, 600);
  };

  // Play right after the element appears (first hover, or auto mode).
  useEffect(() => {
    if (armed && active && videoRef.current) videoRef.current.play().catch(() => {});
  }, [armed, active]);

  useEffect(() => {
    if (canVideo && videoMode === 'auto') start();
    return () => clearTimeout(resetTimer.current);
  }, [canVideo, videoMode]);

  // Safety net for the reveal: if the frame is on screen but the scroll-triggered reveal never started, show it.
  useEffect(() => {
    if (!reveal) return undefined;
    const t = setTimeout(() => {
      const el = frameRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < (window.innerHeight || 0)) setRevealForced(true);
    }, 1800);
    return () => clearTimeout(t);
  }, [reveal]);

  const revealProps = reveal
    ? {
        initial: { clipPath: 'inset(0 0 100% 0)' },
        whileInView: { clipPath: 'inset(0 0 0% 0)' },
        animate: revealForced ? { clipPath: 'inset(0 0 0% 0)' } : undefined,
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
      }
    : {};

  const videoProps =
    canVideo && !videoFailed
      ? videoMode === 'hover'
        ? {
            onPointerEnter: (event) => event.pointerType === 'mouse' && start(),
            onPointerLeave: (event) => event.pointerType === 'mouse' && stop(),
          }
        : {
            onClick: () => {
              const video = videoRef.current;
              if (!video) return;
              if (video.paused) video.play().catch(() => {});
              else video.pause();
            },
          }
      : {};

  return (
    <motion.span
      ref={frameRef}
      className={`img-frame ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
      data-tone={tone}
      {...revealProps}
      {...videoProps}
    >
      {showPhoto ? (
        <>
          {/* neutral loading state that stays under the photograph until it has fully arrived: never a blank frame */}
          {!loaded && <span className="img-skel" aria-hidden="true" />}
          <img
            key={`${src}|${attempt}`}
            ref={imgRef}
            className={`img-fade${loaded ? ' is-loaded' : ''}`}
            src={src}
            alt={alt ?? label ?? ''}
            loading={eager || reveal ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : undefined}
            decoding="async"
            onLoad={() => setLoadedSrc(src)}
            onError={onImgError}
          />
        </>
      ) : waiting ? (
        <span className="img-skel" role="img" aria-label={alt ?? `${label ?? 'Image'} (loading)`} />
      ) : (
        <span className="img-ph" role="img" aria-label={alt ?? `${label ?? 'Image'} (demo placeholder image)`}>
          {label && (
            <span className="img-name" aria-hidden="true">
              {label}
            </span>
          )}
          <span className="img-tag" aria-hidden="true">
            Demo image
          </span>
        </span>
      )}

      {canVideo && !videoFailed && armed && (
        <video
          key={clipSig}
          ref={videoRef}
          className={`img-video ${active ? 'is-on' : ''}`}
          poster={showPhoto ? src : undefined}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          controls={false}
          tabIndex={-1}
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
        >
          {clip.mp4 && <source src={clip.mp4} type="video/mp4" />}
          {clip.webm && <source src={clip.webm} type="video/webm" />}
        </video>
      )}
      {editable && (
        <MediaEditor
          slotKey={String((Array.isArray(imageKey) ? imageKey[0] : imageKey) || '').toLowerCase()}
          label={label}
          hasImage={showPhoto}
          hasVideo={Boolean(clip)}
          allowVideo={videoKey !== null && videoKey !== undefined && videoKey !== ''}
          forceOn={forceEdit}
        />
      )}
    </motion.span>
  );
}
