import { Link } from 'react-router-dom';
import type { FridgeSummary } from '../api/types';
import { dateTime, temperature } from '../utils/display';
import StatusBadge from './StatusBadge';

export default function FridgeCard({ fridge, query }: { fridge: FridgeSummary; query: string }) {
  return (
    <article className={`fridge-card accent-${fridge.status}`}>
      <p className="eyebrow">{fridge.branch.name}</p>
      <h2>
        <Link to={`/fridges/${fridge.id}?${query}`}>
          {fridge.name}
          <span aria-hidden="true"> ↗</span>
        </Link>
      </h2>
      <div className="badges">
        <StatusBadge status={fridge.status} />
        {fridge.status === 'temperature' && fridge.qualityCount > 0 && (
          <StatusBadge status="quality" />
        )}
      </div>
      <p className="reading">
        {fridge.latestReading ? temperature(fridge.latestReading.temperatureCelsius) : '—'}
      </p>
      <p className="muted">
        Latest valid reading in range
        <br />
        {fridge.latestReading ? dateTime(fridge.latestReading.recordedAt) : 'No valid readings'}
      </p>
      <div className="card-footer">
        <span>
          {fridge.temperatureCount} temperature · {fridge.qualityCount} data-quality findings
        </span>
        {fridge.undatedCount > 0 && <small>Unknown-date evidence: {fridge.undatedCount}</small>}
      </div>
    </article>
  );
}
