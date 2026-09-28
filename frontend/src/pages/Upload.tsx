import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ImportOptions, ImportResult } from '../api/types';
import { request } from '../api/client';
import { useApi } from '../hooks/useApi';
import { dateTime } from '../utils/display';

export default function Upload() {
  const options = useApi<ImportOptions>('/import-options');
  const [loggerId, setLoggerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fridgeId, setFridgeId] = useState('');
  const [placement, setPlacement] = useState('automatic');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult>();
  const logger = options.data?.loggers.find((l) => l.id === loggerId);
  const branch = options.data?.branches.find((b) => b.id === branchId);
  const fridge = branch?.fridges.find((f) => f.id === fridgeId);
  const newLogger = loggerId === 'new';
  const periods = logger?.assignments.filter((a) => a.fridgeId === fridgeId) ?? [];
  function selectLogger(id: string) {
    setLoggerId(id);
    setPlacement('automatic');
    const current = options.data?.loggers
      .find((l) => l.id === id)
      ?.assignments.find((a) => a.validTo === null);
    const owner = options.data?.branches.find((b) =>
      b.fridges.some((f) => f.id === current?.fridgeId),
    );
    setBranchId(owner?.id ?? '');
    setFridgeId(current?.fridgeId ?? '');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const file = values.get('file') as File;
    if (!file?.size) {
      setError('Choose a CSV file with readings.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose a CSV smaller than 2 MB.');
      return;
    }
    const body = new FormData();
    body.set('file', file);
    body.set('loggerExternalId', logger?.externalId ?? String(values.get('newLogger')).trim());
    body.set('branch', branch?.name ?? String(values.get('newBranch')).trim());
    body.set('fridge', fridge?.name ?? String(values.get('newFridge')).trim());
    if (newLogger) {
      body.set('temperatureUnit', String(values.get('temperatureUnit')));
      body.set('expectedIntervalMinutes', String(values.get('interval')));
    }
    if (newLogger || placement === 'move')
      body.set('assignmentValidFrom', String(values.get('start')));
    if (placement === 'period') body.set('assignmentId', String(values.get('period')));
    setBusy(true);
    setError('');
    try {
      setResult(await request<ImportResult>('/imports', { method: 'POST', body }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Add historical records</p>
          <h1>Upload logger data</h1>
          <p className="muted">Choose a file and tell us where its readings belong.</p>
        </div>
      </div>
      {options.loading && <p role="status">Loading upload choices…</p>}
      {options.error && (
        <div className="notice error" role="alert">
          {options.error} <button onClick={options.retry}>Try again</button>
        </div>
      )}
      {result ? (
        <section className="panel upload-result" aria-live="polite">
          <span className="badge clear">Import complete</span>
          <h2>Your history is ready</h2>
          <div className="summary">
            <div>
              <strong>{result.acceptedRows}</strong>
              <span>Accepted readings</span>
            </div>
            <div>
              <strong>{result.invalidRows}</strong>
              <span>Invalid rows retained</span>
            </div>
            <div>
              <strong>{result.duplicateRows}</strong>
              <span>Duplicates skipped</span>
            </div>
          </div>
          <h3>History after upload</h3>
          <p>
            {result.analysis.temperatureIncidents} temperature incidents ·{' '}
            {result.analysis.dataGaps} data gaps · {result.analysis.invalidReadings} invalid-reading
            findings
          </p>
          <p className="muted">
            These findings cover accumulated history for the affected fridges, including the
            previous fridge after a move. They are not counts of new incidents.
          </p>
          <div className="actions">
            <Link className="button" to={`/fridges/${result.fridgeId}`}>
              View fridge history
            </Link>
            <Link className="button secondary" to="/">
              Back to overview
            </Link>
            <button
              className="secondary"
              onClick={() => {
                setResult(undefined);
                selectLogger('');
                options.retry();
              }}
            >
              Upload another file
            </button>
          </div>
        </section>
      ) : (
        options.data && (
          <form className="upload-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              <legend>1. Choose your file</legend>
              <label>
                Logger CSV
                <input name="file" type="file" accept=".csv,text/csv" required />
              </label>
              <p className="muted small">
                Up to 2 MB. A timestamp and temperature column are required. Readings may be in
                either order.
              </p>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>2. Identify the logger</legend>
              <label>
                Logger
                <select required value={loggerId} onChange={(e) => selectLogger(e.target.value)}>
                  <option value="">Choose a logger</option>
                  {options.data.loggers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.externalId}
                    </option>
                  ))}
                  <option value="new">＋ New logger</option>
                </select>
              </label>
              {newLogger && (
                <div className="form-grid">
                  <label>
                    New logger ID
                    <input name="newLogger" required maxLength={120} />
                  </label>
                  <label>
                    File temperature unit
                    <select name="temperatureUnit" required defaultValue="">
                      <option value="" disabled>
                        Choose the source unit
                      </option>
                      <option value="CELSIUS">Celsius (°C)</option>
                      <option value="FAHRENHEIT">Fahrenheit (°F)</option>
                    </select>
                  </label>
                  <label>
                    Expected interval (minutes)
                    <input
                      name="interval"
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      defaultValue="15"
                      required
                    />
                  </label>
                </div>
              )}
              {logger && (
                <p className="muted">
                  File unit:{' '}
                  {logger.temperatureUnit === 'CELSIUS' ? 'Celsius (°C)' : 'Fahrenheit (°F)'} ·
                  Expected readings every {logger.expectedIntervalMinutes} minutes.
                </p>
              )}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>3. Where were these readings taken?</legend>
              <div className="form-grid">
                <label>
                  Branch
                  <select
                    required
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setFridgeId('');
                      setPlacement('automatic');
                    }}
                  >
                    <option value="">Choose a branch</option>
                    {options.data.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    <option value="new">＋ New branch</option>
                  </select>
                </label>
                {branchId === 'new' && (
                  <label>
                    New branch name
                    <input name="newBranch" required maxLength={120} />
                  </label>
                )}
                <label>
                  Fridge
                  <select
                    required
                    value={fridgeId}
                    onChange={(e) => {
                      setFridgeId(e.target.value);
                      setPlacement('automatic');
                    }}
                  >
                    <option value="">Choose a fridge</option>
                    {branch?.fridges.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                    <option value="new">＋ New fridge</option>
                  </select>
                </label>
                {fridgeId === 'new' && (
                  <label>
                    New fridge name
                    <input name="newFridge" required maxLength={120} />
                  </label>
                )}
              </div>
              {logger && (
                <label>
                  Logger placement
                  <select value={placement} onChange={(e) => setPlacement(e.target.value)}>
                    <option value="automatic">Use the recorded location history</option>
                    <option value="move">Start using this logger here / move it here</option>
                    {periods.length > 0 && (
                      <option value="period">Choose a known period (for missing dates)</option>
                    )}
                  </select>
                </label>
              )}
              {(newLogger || placement === 'move') && (
                <>
                  <label>
                    Logger started here
                    <input name="start" type="datetime-local" required step="60" />
                  </label>
                  <p className="small muted">
                    Use the branch’s local date and time, at or before the first reading in this
                    file. A move closes the previous location period. Earlier readings stay with
                    their original fridge.
                  </p>
                </>
              )}
              {placement === 'period' && (
                <label>
                  Known location period
                  <select name="period" required>
                    <option value="">Choose the period for this file</option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {dateTime(p.validFrom)} –{' '}
                        {p.validTo ? dateTime(p.validTo) : 'no recorded end'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!newLogger && placement === 'automatic' && (
                <p className="small muted">
                  File dates must fit an existing period at this fridge. If the logger has moved,
                  choose “move it here” and enter the actual start time.
                </p>
              )}
            </fieldset>
            {error && (
              <div className="notice error" role="alert">
                <strong>File not imported</strong>
                <p>
                  {error
                    .replaceAll('assignmentValidFrom', 'logger start time')
                    .replaceAll('assignmentId', 'known location period')
                    .replaceAll('assignment', 'location period')}
                </p>
                <p className="small">
                  Check the file and location details, then try again. No partial import was saved.
                </p>
              </div>
            )}
            <p className="small muted">
              Times stay branch-local. Invalid rows are kept as evidence; repeated readings are
              skipped. Temperature values are never used to guess units.
            </p>
            <button type="submit" disabled={busy}>
              {busy ? 'Importing and checking history…' : 'Import CSV'}
            </button>
          </form>
        )
      )}
    </>
  );
}
