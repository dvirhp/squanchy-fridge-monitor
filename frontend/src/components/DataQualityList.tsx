import type { Finding } from '../api/types';
import { dateTime } from '../utils/display';

export default function DataQualityList({
  findings,
  undated,
}: {
  findings: Finding[];
  undated: Finding[];
}) {
  return (
    <section className="panel">
      <h2>
        Data-quality evidence <span className="count">{findings.length + undated.length}</span>
      </h2>
      <p className="small muted">
        Missing or unusable observations limit what can be concluded about temperature.
      </p>
      {!findings.length && !undated.length && <p>No data-quality findings in this range.</p>}
      <ul className="findings">
        {[...findings, ...undated].map((f) => (
          <li key={f.id}>
            <span className="badge quality">
              {f.type === 'DATA_GAP' ? 'Data gap' : 'Invalid reading'}
            </span>
            <p>
              <strong>{dateTime(f.startedAt)}</strong>
              {f.type === 'DATA_GAP' && ` → ${dateTime(f.endedAt)}`}
            </p>
            <p>
              {f.type === 'DATA_GAP'
                ? `${f.durationMinutes} minutes between observations; expected interval ${f.details?.expectedIntervalMinutes} minutes.`
                : String(f.details?.reason ?? 'Unusable reading')}
            </p>
            {f.details?.sourceRowNumber && (
              <p className="small muted">Source CSV row {f.details.sourceRowNumber}</p>
            )}
            {!f.startedAt && (
              <p className="small muted">
                Date unknown. Retained as evidence for this fridge regardless of the selected date
                range.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
