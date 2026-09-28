import type { Reading } from '../api/types';
import { localMinutes } from './display';

export interface ChartPoint {
  x: number;
  value: number;
  recordedAt: string;
  logger: string;
}

// Continuity uses immutable import snapshots, independently of today's placement.
export function chartSegments(readings: Reading[]): ChartPoint[][] {
  const groups = new Map<string, Reading[]>();
  for (const row of readings) {
    const key = `${row.loggerId}/${row.assignmentId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const segments: ChartPoint[][] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    let segment: ChartPoint[] = [];
    let previous: Reading | undefined;
    for (let i = 0; i < group.length; ) {
      let end = i + 1;
      while (end < group.length && group[end].recordedAt === group[i].recordedAt) end++;
      const rows = group.slice(i, end),
        row = rows[0];
      const invalid =
        rows.some((r) => r.status !== 'VALID' || r.temperatureCelsius === null) ||
        new Set(rows.map((r) => r.temperatureCelsius)).size > 1 ||
        new Set(rows.map((r) => r.expectedIntervalMinutes)).size > 1;
      const interrupted =
        previous &&
        (previous.expectedIntervalMinutes !== row.expectedIntervalMinutes ||
          localMinutes(row.recordedAt) - localMinutes(previous.recordedAt) >
            previous.expectedIntervalMinutes);
      if (invalid || interrupted) {
        if (segment.length) segments.push(segment);
        segment = [];
      }
      if (!invalid)
        segment.push({
          x: localMinutes(row.recordedAt),
          value: row.temperatureCelsius!,
          recordedAt: row.recordedAt,
          logger: row.loggerExternalId,
        });
      previous = invalid ? undefined : row;
      i = end;
    }
    if (segment.length) segments.push(segment);
  }
  return segments;
}
