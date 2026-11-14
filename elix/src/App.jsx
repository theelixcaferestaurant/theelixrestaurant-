import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { INTRO } from './data/siteData';
import { introStore } from './hooks/useIntro';
import { startLiveContent, useContentVersion } from './lib/content';
import { useScrollReveal } from './hooks/useScrollReveal';

// The private dashboard is a separate bundle: visitors of the public site never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import TimingsSection from './components/TimingsSection';
import SocialSidebar from './components/SocialSidebar';
import IntroScreen from './components/IntroScreen';
import SearchOverlay from './components/SearchOverlay';
import EditBar from './components/EditBar';
import ClosureBanner from './components/ClosureBanner';
import { loadLocalMedia, startAdminPreview } from './lib/localMedia';
import Home from './pages/Home';

// Every other public page is its own small chunk, so the landing page does not download code for pages the visitor
// has not opened. The chunks are fetched quietly once the browser is idle, so moving between pages stays instant.
const pageLoaders = {
  Explore: () => import('./pages/Explore'),
  DineIn: () => import('./pages/DineIn'),
  TakeAway: () => import('./pages/TakeAway'),
  Chai: () => import('./pages/Chai'),
  Tiffins: () => import('./pages/Tiffins'),
  Bakery: () => import('./pages/Bakery'),
  Food: () => import('./pages/Food'),
  Mandi: () => import('./pages/Mandi'),
  Shawarma: () => import('./pages/Shawarma'),
  MenuCategory: () => import('./pages/MenuCategory'),
  About: () => import('./pages/About'),
  Gallery: () => import('./pages/Gallery'),
  Reviews: () => import('./pages/Reviews'),
  Contact: () => import('./pages/Contact'),
  NotFound: () => import('./pages/NotFound'),
  PartyOrders: () => import('./pages/PartyOrders'),
};
const Explore = lazy(pageLoaders.Explore);
const DineIn = lazy(pageLoaders.DineIn);
const TakeAway = lazy(pageLoaders.TakeAway);
const TakeAwayPage = lazy(() => pageLoaders.TakeAway().then((m) => ({ default: m.TakeAwayPage })));
const Chai = lazy(pageLoaders.Chai);
const Tiffins = lazy(pageLoaders.Tiffins);
const Bakery = lazy(pageLoaders.Bakery);
const Food = lazy(pageLoaders.Food);
const Mandi = lazy(pageLoaders.Mandi);
const Shawarma = lazy(pageLoaders.Shawarma);
const MenuCategory = lazy(pageLoaders.MenuCategory);
const About = lazy(pageLoaders.About);
const Gallery = lazy(pageLoaders.Gallery);
const Reviews = lazy(pageLoaders.Reviews);
const Contact = lazy(pageLoaders.Contact);
const NotFound = lazy(pageLoaders.NotFound);
const PartyOrders = lazy(pageLoaders.PartyOrders);

// Fetch the other pages' code after the first screen is done (never competes with the landing page's own loading).
function prefetchPages() {
  const run = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 4000);
}

const INTRO_KEY = 'elix-intro-seen';

// The landing video plays whenever the home page is opened (set INTRO.frequency to 'session' in
// siteData.js to play it only once per browser session). It never plays on the other pages.
function shouldShowIntro(location) {
  if (location.pathname !== '/') return false;
  if (INTRO.frequency !== 'session') return true;
  try {
    return sessionStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return true;
  }
}

export default function App() {
  const location = useLocation();
  useContentVersion(); // re-render the whole public site when the dashboard saves a change
  const [showIntro, setShowIntro] = useState(() => {
    const show = shouldShowIntro(location);
    introStore.set(!show); // the home hero waits for the intro to finish
    return show;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  useScrollReveal(); // scroll-triggered fade / slide-up of page sections

  // When the animation ends the intro closes by itself and the home page is already underneath.
  const finishIntro = useCallback(() => {
    setShowIntro(false);
    introStore.set(true);
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* storage unavailable: nothing to remember */
    }
  }, []);

  // Connect the public site to the database (no-op when Supabase is not configured).
  useEffect(() => {
    startLiveContent();
    loadLocalMedia();
    startAdminPreview();
    if (!window.location.pathname.startsWith('/admin')) prefetchPages();
  }, []);

  // Close search whenever the route changes.
  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  // The static canonical tag (added at build time) belongs to the page that was loaded first. When the visitor moves on,
  // or opens a deeper page such as /food/..., keep it pointing at the page actually shown (same web address as before).
  useEffect(() => {
    const link = document.querySelector('link[rel="canonical"]');
    if (!link) return;
    try {
      if (!link.dataset.origin) link.dataset.origin = new URL(link.href).origin;
      const path = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/';
      link.href = link.dataset.origin + path;
    } catch {
      /* leave the tag as it is */
    }
  }, [location.pathname]);

  // /admin is a completely separate application: no public navbar, footer, intro or theme.
  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading dashboard…</div>}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <AnimatePresence>{showIntro && <IntroScreen key="intro" onDone={finishIntro} />}</AnimatePresence>

      <Navbar onSearch={() => setSearchOpen(true)} />
      <ClosureBanner />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <main id="main" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
          <motion.div
            key={location.pathname}
            className="page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <Suspense fallback={null}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/explore/dine" element={<DineIn />} />
              <Route path="/explore/take" element={<TakeAway />} />
              <Route path="/explore/take/menu" element={<TakeAwayPage />} />
              <Route path="/explore/take/party" element={<PartyOrders />} />
              <Route path="/chai" element={<Chai />} />
              <Route path="/tiffins" element={<Tiffins />} />
              <Route path="/bakery" element={<Bakery />} />
              <Route path="/food/*" element={<Food />} />
              <Route path="/mandi" element={<Mandi />} />
              <Route path="/shawarma" element={<Shawarma />} />
              <Route path="/menu/:key" element={<MenuCategory />} />
              <Route path="/about" element={<About />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <SocialSidebar />
      <TimingsSection />
      <Footer />
      <EditBar />
    </MotionConfig>
  );
}
