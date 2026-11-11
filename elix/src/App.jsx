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
import Explore from './pages/Explore';
import DineIn from './pages/DineIn';
import TakeAway, { TakeAwayPage } from './pages/TakeAway';
import Chai from './pages/Chai';
import Tiffins from './pages/Tiffins';
import Bakery from './pages/Bakery';
import Food from './pages/Food';
import Mandi from './pages/Mandi';
import Shawarma from './pages/Shawarma';
import About from './pages/About';
import Gallery from './pages/Gallery';
import Reviews from './pages/Reviews';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import PartyOrders from './pages/PartyOrders';

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
  }, []);

  // Close search whenever the route changes.
  useEffect(() => {
    setSearchOpen(false);
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
              <Route path="/about" element={<About />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
