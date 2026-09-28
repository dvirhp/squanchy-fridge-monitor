import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { getHealth } from './api/health';

function Home() {
  const [status, setStatus] = useState('Checking connection…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('Checking connection…');
    getHealth(controller.signal)
      .then(() => setStatus('Backend and database connected.'))
      .catch(() => { if (!controller.signal.aborted) setStatus('Cannot connect. Check that the backend is running.'); });
    return () => controller.abort();
  }, [attempt]);
  return <main>
    <p className="eyebrow">Squanchy Bakery</p>
    <h1>Fridge Monitor</h1>
    <p>The project foundation is ready. Uploads and fridge monitoring will follow in later tasks.</p>
    <section aria-labelledby="connection-title">
      <h2 id="connection-title">Local connection</h2>
      <p role="status">{status}</p>
      <button onClick={() => setAttempt(value => value + 1)}>Check again</button>
    </section>
  </main>;
}
export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="*" element={<main><h1>Page not found</h1><Link to="/">Return home</Link></main>} /></Routes>;
}
