import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePage';
import BackButton from '../components/BackButton';

export default function NotFound() {
  usePageTitle('Page not found | The Elix');

  // Unknown addresses are answered with the app shell, so mark them noindex to avoid soft-404 pages in search results.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <section className="page-hero center">
      <div className="container">
        <BackButton to="/" />
        <h1 className="display-xl">Page not found</h1>
        <p className="lead centered-lead">This address does not match any page in the demonstration.</p>
        <div className="hero-actions is-centered">
          <Link className="btn" to="/">
            Back to home
          </Link>
          <Link className="btn btn-ghost" to="/explore">
            Explore Menu
          </Link>
        </div>
      </div>
    </section>
  );
}
