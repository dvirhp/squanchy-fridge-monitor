import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Reading } from '../api/types';
import { chartSegments } from '../utils/chart-segments';
import { dateTime, temperature } from '../utils/display';
export default function TemperatureChart({ readings }: { readings: Reading[] }) {
  const segments = useMemo(() => chartSegments(readings), [readings]);
  const points = useMemo(() => segments.flat().sort((a, b) => a.x - b.x), [segments]);
  const [selected, setSelected] = useState(0);
  if (!points.length) return <div className="empty">No unambiguous valid readings in this range. See data-quality evidence below.</div>;
  const point = points[Math.min(selected, points.length - 1)];
  const ticks = [...new Set([points[0].x, points[Math.floor(points.length / 2)].x, points[points.length - 1].x])];
  return <><div className="chart" role="img" aria-label="Historical temperature in Celsius. The reference line is 5 degrees. Broken lines indicate interrupted observation continuity. Use the reading controls below for values.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart accessibilityLayer margin={{ top: 25, right: 25, bottom: 15, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} ticks={ticks}
          tickFormatter={x => { const p = points.find(p => p.x === x); return p ? p.recordedAt.slice(5, 16).replace('T', ' ') : ''; }} tick={{ fontSize: 11 }} />
        <YAxis unit="°" domain={[(min: number) => Math.min(min - 1, 4), (max: number) => Math.max(max + 1, 6)]} width={45} />
        <ReferenceLine y={5} stroke="#b64135" strokeDasharray="5 4" label={{ value: '5°C threshold', position: 'insideTopRight', fill: '#94382d', fontSize: 12 }} />
        <Tooltip content={({ active, payload }) => {
          const p = payload?.find(entry => entry.value != null)?.payload as typeof point | undefined;
          return active && p ? <div className="chart-tooltip"><strong>{temperature(p.value)}</strong><br />{dateTime(p.recordedAt)}<br />Logger {p.logger}</div> : null;
        }} />
        {segments.map((segment, index) => <Line key={index} data={segment} type="linear" dataKey="value" stroke="#176453" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />)}
      </LineChart>
    </ResponsiveContainer></div>
    <div className="chart-readout"><button className="secondary" aria-label="Previous reading" disabled={selected <= 0} onClick={() => setSelected(i => i - 1)}>←</button>
      <output aria-live="polite">{dateTime(point.recordedAt)} · <strong>{temperature(point.value)}</strong><br /><span className="small">Logger {point.logger} · Reading {Math.min(selected + 1, points.length)} of {points.length}</span></output>
      <button className="secondary" aria-label="Next reading" disabled={selected >= points.length - 1} onClick={() => setSelected(i => i + 1)}>→</button></div>
    <p className="small muted">Branch-local time · Lines stop at invalid/conflicting values, missed expected readings, interval changes, and logger placement boundaries. Isolated high readings do not establish a sustained incident.</p></>;
}
