import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { getImage } from '../data/images';
import { getVideo } from '../data/videos';
import { useContentVersion } from '../lib/content';
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
  const [failed, setFailed] = useState(false);
  const src = imageKey ? getImage(imageKey) : null;
  useEffect(() => setFailed(false), [src]);
  const showPhoto = Boolean(src) && !failed;

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

  const revealProps = reveal
    ? {
        initial: { clipPath: 'inset(0 0 100% 0)' },
        whileInView: { clipPath: 'inset(0 0 0% 0)' },
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
      className={`img-frame ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
      data-tone={tone}
      {...revealProps}
      {...videoProps}
    >
      {showPhoto ? (
        <img
          src={src}
          alt={alt ?? label ?? ''}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
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
