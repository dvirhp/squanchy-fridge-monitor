import type { Finding } from '../api/types';
import { dateTime, temperature } from '../utils/display';

export default function IncidentList({ findings }: { findings: Finding[] }) {
  return (
    <section className="panel">
      <h2>
        Temperature incidents <span className="count">{findings.length}</span>
      </h2>
      <p className="muted small">
        Above 5°C for at least two consecutive expected readings. Times and durations are
        sampling-based; the exact threshold crossing is unknown.
      </p>
      {!findings.length && <p>No sustained temperature incidents found in this range.</p>}
      <ul className="findings">
        {findings.map((f) => (
          <li key={f.id}>
            <div className="section-heading">
              <strong>Above 5°C</strong>
              <span className="badge temperature">
                {f.details?.state === 'RECOVERED'
                  ? 'Recovered'
                  : f.details?.state === 'INTERRUPTED'
                    ? 'Interrupted'
                    : 'Ongoing in uploaded data'}
              </span>
            </div>
            <dl>
              <div>
                <dt>First high reading</dt>
                <dd>{dateTime(f.startedAt)}</dd>
              </div>
              <div>
                <dt>{f.endedAt ? 'Recovery observed' : 'Last observed high'}</dt>
                <dd>{dateTime(f.endedAt ?? String(f.details?.lastObservedHighAt ?? ''))}</dd>
              </div>
              <div>
                <dt>Sampling-based duration</dt>
                <dd>
                  {f.durationMinutes === null
                    ? 'Unknown — no observed recovery'
                    : `${f.durationMinutes} minutes`}
                </dd>
              </div>
              <div>
                <dt>Peak</dt>
                <dd>
                  {f.peakTemperatureCelsius === null
                    ? 'Unknown'
                    : temperature(f.peakTemperatureCelsius)}
                </dd>
              </div>
            </dl>
            {f.details?.state === 'INTERRUPTED' && (
              <p className="small muted">
                Observation continuity ended before recovery could be confirmed.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
