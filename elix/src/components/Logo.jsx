import { motion } from 'motion/react';

const draw = (delay) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { delay, duration: 1.1, ease: [0.22, 1, 0.36, 1] },
});

// The Elix mark: a double ring around a monoline "E" with a small diamond.
// Uses currentColor, so it follows the theme. Set animated to draw it in line by line.
export default function Logo({ size = 40, animated = false, className = '' }) {
  const Path = animated ? motion.path : 'path';
  const Circle = animated ? motion.circle : 'circle';
  const anim = (delay) => (animated ? draw(delay) : {});

  return (
    <svg
      className={`logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Circle cx="60" cy="60" r="55" {...anim(0)} />
      <Circle cx="60" cy="60" r="49" strokeWidth="0.9" {...anim(0.2)} />
      <Path d="M46 34 V86" {...anim(0.5)} />
      <Path d="M46 34 H80" {...anim(0.7)} />
      <Path d="M46 60 H72" {...anim(0.85)} />
      <Path d="M46 86 H80" {...anim(1)} />
      <Path d="M88 52 L94 60 L88 68 L82 60 Z" strokeWidth="1.5" {...anim(1.15)} />
    </svg>
  );
}
