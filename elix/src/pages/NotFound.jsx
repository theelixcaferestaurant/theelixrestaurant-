import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePage';
import BackButton from '../components/BackButton';

export default function NotFound() {
  usePageTitle('Page not found | The Elix');

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
