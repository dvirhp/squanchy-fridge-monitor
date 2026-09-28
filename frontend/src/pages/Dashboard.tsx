import { Link, useSearchParams } from 'react-router-dom';
import type { DashboardData, ImportOptions } from '../api/types';
import { useApi } from '../hooks/useApi';
import DateRangeFilter from '../components/DateRangeFilter';
import FridgeCard from '../components/FridgeCard';
import { dateQuery } from '../utils/display';

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const result = useApi<DashboardData>(`/dashboard?${params}`);
  const options = useApi<ImportOptions>('/import-options');
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Bakery operations</p>
          <h1>Every fridge. One place.</h1>
          <p className="muted">Latest uploaded data · Historical records, ready for review.</p>
        </div>
        <Link className="button" to="/upload">
          Upload logger file
        </Link>
      </div>
      <section className="filters" aria-label="Filter fridges">
        <DateRangeFilter />
        <label>
          Branch
          <select
            value={params.get('branchId') ?? ''}
            onChange={(e) => change('branchId', e.target.value)}
          >
            <option value="">All branches</option>
            {options.data?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={params.get('status') ?? ''}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="temperature">Temperature issues</option>
            <option value="quality">Data-quality issues</option>
            <option value="clear">No detected issue</option>
            <option value="no-data">No data in range</option>
          </select>
        </label>
      </section>
      {options.error && (
        <p role="alert">
          Branch choices unavailable. <button onClick={options.retry}>Retry branches</button>
        </p>
      )}
      {result.loading && <p role="status">Loading fridge history…</p>}
      {result.error && (
        <div className="notice error" role="alert">
          {result.error} <button onClick={result.retry}>Try again</button>
        </div>
      )}
      {result.data && (
        <>
          <section className="summary" aria-label="Fridge counts">
            {[
              ['Fridges', result.data.counts.total],
              ['Temperature issues', result.data.counts.temperature],
              ['Data-quality issues', result.data.counts.quality],
              ['No detected issue', result.data.counts.clear],
              ['No data', result.data.counts.noData],
            ].map(([label, count]) => (
              <div key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>
          <div className="section-heading">
            <h2>Fridge overview</h2>
            <span className="muted">Problems first · {result.data.fridges.length} shown</span>
          </div>
          <p className="small muted">
            Counts reflect the selected dates and branch, before the status filter. A fridge may
            have both kinds of issue. Unknown-date evidence remains visible.
          </p>
          <div className="fridge-grid">
            {result.data.fridges.map((fridge) => (
              <FridgeCard key={fridge.id} fridge={fridge} query={dateQuery(params)} />
            ))}
          </div>
          {!result.data.fridges.length && (
            <div className="empty">
              <h2>No fridges match</h2>
              <p>Try another filter, or upload your first logger file.</p>
              <Link to="/upload">Upload a file</Link>
            </div>
          )}
          <p className="small muted">
            No detected issue means no sustained temperature incident or data-quality finding in
            this range. It is not a guarantee of safe storage.
          </p>
        </>
      )}
    </>
  );
}
