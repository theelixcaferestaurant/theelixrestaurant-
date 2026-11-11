import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { INTRO } from '../data/siteData';
import { useFocusTrap } from '../hooks/usePage';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Landing page: plays the restaurant's logo animation (about 5.8 seconds) full screen on the site's own
// background, then fades out to the home page, which is already underneath.
// - The animation is always silent: the video is muted and there is no sound control.
// - If a browser blocks autoplay completely, a Play button is shown.
// - If the video file cannot load at all, the intro closes instead of leaving visitors stuck.
// - With the "reduce motion" setting, the final logo frame is held briefly instead of the video.
export default function IntroScreen({ onDone }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [reduced] = useState(prefersReducedMotion);
  const [blocked, setBlocked] = useState(false);

  useFocusTrap(ref, true);

  const finish = () => doneRef.current();

  // Start silent playback (muted autoplay is allowed by every mainstream browser).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced) return undefined;
    video.muted = true;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((error) => {
        if (error && error.name === 'AbortError') return;
        setBlocked(true);
      });
    }
    return undefined;
  }, [reduced]);

  // If the browser blocks playback completely and nobody taps Play, do not leave visitors stuck:
  // open the site after a few seconds (the Play button stays available until then).
  useEffect(() => {
    if (!blocked) return undefined;
    const timer = setTimeout(finish, 6000);
    return () => clearTimeout(timer);
  }, [blocked]);

  // Reduced motion: hold the final logo frame for a moment, then open the site.
  useEffect(() => {
    if (!reduced) return undefined;
    const timer = setTimeout(finish, 1800);
    return () => clearTimeout(timer);
  }, [reduced]);

  // Safety net: if playback stalls and "ended" never fires, open the site anyway.
  const watchdog = useRef(null);
  useEffect(() => () => clearTimeout(watchdog.current), []);

  const handlePlaying = () => {
    setBlocked(false);
    const video = videoRef.current;
    const seconds = video && Number.isFinite(video.duration) ? video.duration : 5.8;
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(finish, seconds * 1000 + 3000);
  };

  // Play button, shown only when autoplay was refused entirely. Playback stays silent.
  const startManually = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(finish);
  };

  return (
    <motion.div
      ref={ref}
      className="intro"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to The Elix"
      tabIndex={-1}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <div className="intro-stage">
        {reduced ? (
          <img className="intro-media" src={INTRO.finalFrame} alt="The Elix, Cafe and Restaurant" />
        ) : (
          <video
            ref={videoRef}
            className="intro-media"
            poster={INTRO.firstFrame}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            aria-label="The Elix logo animation"
            onPlaying={handlePlaying}
            onEnded={() => setTimeout(finish, 120)}
          >
            {/* MP4 first (every mainstream browser); WebM for browsers built without H.264.
                If neither can load, the error fires on the last source and the site opens instead. */}
            <source src={INTRO.video} type="video/mp4" />
            <source src={INTRO.videoWebm} type="video/webm" onError={finish} />
          </video>
        )}
      </div>

      {!reduced && blocked && (
        <button type="button" className="intro-play" onClick={startManually} aria-label="Play welcome animation">
          <Play size={30} aria-hidden="true" />
        </button>
      )}

    </motion.div>
  );
}
