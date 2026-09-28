import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';

const FridgeDetails = lazy(() => import('./pages/FridgeDetails'));

export default function App() {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            Squanchy<span className="brand-sub">Fridge records</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/upload">Upload</NavLink>
        </nav>
      </header>
      <main id="content">
        <Suspense fallback={<p role="status">Loading page…</p>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/fridges/:id" element={<FridgeDetails />} />
            <Route
              path="*"
              element={
                <>
                  <h1>Page not found</h1>
                  <Link to="/">Return to overview</Link>
                </>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>Squanchy Bakery · Historical logger records</footer>
    </>
  );
}
