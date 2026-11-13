import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SUPABASE_URL, isSupabaseConfigured } from './lib/supabase';
import './styles/themes.css';
import './styles/themes.generated.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/animations.css';

// Open the connection to the Supabase origin early (photos and data come from there). Read-only hint; no config change.
if (isSupabaseConfigured) {
  try {
    const origin = new URL(SUPABASE_URL).origin;
    // one hint for data requests (CORS mode) and one for plain image loads
    [true, false].forEach((cors) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      if (cors) link.crossOrigin = '';
      document.head.appendChild(link);
    });
  } catch {
    /* invalid URL: skip the hint */
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
