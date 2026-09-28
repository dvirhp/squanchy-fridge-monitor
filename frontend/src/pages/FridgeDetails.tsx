import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { FridgeData } from '../api/types';
import { useApi } from '../hooks/useApi';
import { dateQuery } from '../utils/display';
import DateRangeFilter from '../components/DateRangeFilter';
import TemperatureChart from '../components/TemperatureChart';
import IncidentList from '../components/IncidentList';
import DataQualityList from '../components/DataQualityList';
export default function FridgeDetails() {
  const { id } = useParams(); const [params] = useSearchParams(); const query = dateQuery(params);
  const result = useApi<FridgeData>(`/fridges/${encodeURIComponent(id ?? '')}?${query}`);
  return <><Link className="back-link" to={`/?${query}`}>← All fridges</Link>
    {result.data && <div className="page-heading"><div><p className="eyebrow">{result.data.branch.name}</p><h1>{result.data.name}</h1><p className="muted">Latest uploaded data · Accumulated fridge history</p></div><Link className="button secondary" to="/upload">Upload data</Link></div>}
    <section className="filters" aria-label="Filter history"><DateRangeFilter /></section>
    {result.loading && <p role="status">Loading fridge history…</p>}
    {result.error && <div className="notice error" role="alert">{result.error} <button onClick={result.retry}>Try again</button></div>}
    {result.data && <>
      <section className="panel"><div className="section-heading"><h2>Temperature history</h2><span className="muted small">°C · Branch-local time</span></div><TemperatureChart key={`${id}/${query}`} readings={result.data.readings} /></section>
      <IncidentList findings={result.data.temperatureIncidents} /><DataQualityList findings={result.data.dataQuality} undated={result.data.undatedQuality} />
      <p className="small muted">Incidents overlapping your date range show their complete observed history, not a clipped duration. “Ongoing” describes the end of uploaded observations, not the fridge’s condition now.</p></>}
  </>;
}
