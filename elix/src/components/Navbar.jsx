import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, Search, X } from 'lucide-react';
import { BUSINESS } from '../data/siteData';
import { CATEGORY_PATHS } from '../themes/themeConfig';
import { useFocusTrap } from '../hooks/usePage';

const DRAWER_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore Menu' },
  { to: '/about', label: 'About Us' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
];

// Closes the drawer, waits for it to finish leaving (the page scroll is locked while it is open),
// then scrolls smoothly to the DAILY TIMINGS section. scroll-margin-top keeps it clear of the header.
function goToTimings(event, onClose) {
  event.preventDefault();
  onClose();
  const started = Date.now();
  const tick = () => {
    const el = document.getElementById('timings');
    const locked = document.body.style.overflow === 'hidden';
    if (locked && Date.now() - started < 1500) {
      setTimeout(tick, 50);
      return;
    }
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };
  setTimeout(tick, 480);
}

function Drawer({ onClose }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onClose);

  return (
    <>
      <motion.div
        className="drawer-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.aside
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <button type="button" className="icon-btn drawer-close" onClick={onClose} aria-label="Close site menu" data-autofocus>
          <X size={22} />
        </button>

        <nav className="drawer-links" aria-label="Site menu">
          {DRAWER_LINKS.map((link, index) => (
            <motion.div
              key={link.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + index * 0.05, duration: 0.4 }}
            >
              <NavLink to={link.to} end={link.to === '/'} onClick={onClose}>
                {link.label}
              </NavLink>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + DRAWER_LINKS.length * 0.05, duration: 0.4 }}
          >
            <a href="#timings" onClick={(event) => goToTimings(event, onClose)}>
              Timings
            </a>
          </motion.div>
        </nav>

        <p className="drawer-foot">{BUSINESS.address}</p>
      </motion.aside>
    </>
  );
}

export default function Navbar({ onSearch }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isHome = pathname === '/';

  // "Explore Menu" stays highlighted on the Explore page and on every category page.
  const exploreActive =
    pathname === '/explore' || pathname.startsWith('/explore/') || CATEGORY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <>
      <header className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container navbar-inner">
          <div className="navbar-left">
            <button
              type="button"
              className="icon-btn navbar-menu-btn"
              onClick={() => setOpen(true)}
              aria-label="Open site menu"
              aria-expanded={open}
              aria-haspopup="dialog"
            >
              <Menu size={23} />
            </button>
            <Link to="/" className="brand" aria-label="The Elix, home">
              <img className="brand-logo" src="/assets/brand/the-elix-logo-152.png" alt="" width="38" height="38" decoding="async" />
              <span className="brand-name">THE ELIX</span>
            </Link>
          </div>

          <nav className="navbar-links" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/explore" className={exploreActive ? 'active' : ''}>
              Explore Menu
            </NavLink>
          </nav>

          {/* The search lives on the Home page only. */}
          {isHome && (
            <div className="navbar-tools">
              <button type="button" className="icon-btn" onClick={onSearch} aria-label="Search the menu">
                <Search size={21} />
              </button>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence>{open && <Drawer key="drawer" onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
