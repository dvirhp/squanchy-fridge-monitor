import type { ReadingStatus } from '@prisma/client';

export const ANALYSIS_RULES = {
  highTemperatureCelsius: 5,
  sustainedReadings: 2,
  gapIntervalMultiplier: 2,
} as const;

export interface AnalysisReading {
  id: string;
  recordedAt: string | null;
  temperatureCelsius: number | null;
  status: ReadingStatus;
  sourceRowNumber: number;
  validationError: string | null;
  expectedIntervalMinutes: number;
}

export interface Observation {
  at: string;
  temperatureCelsius: number | null;
  expectedIntervalMinutes: number;
  interruptionReason: string | null;
}

export interface Finding {
  type: 'TEMPERATURE' | 'DATA_GAP' | 'INVALID_READING';
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  peakTemperatureCelsius: number | null;
  details: Record<string, string | number | string[]>;
}

// Gregorian calendar arithmetic on already validated local timestamps.
// No timezone, DST conversion, Date parsing, or current clock is involved.
function localSeconds(timestamp: string): number {
  const [year, month, day, hour, minute, second] = timestamp.split(/[-T:]/).map(Number);
  const precedingYear = year - 1;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days =
    precedingYear * 365 +
    Math.floor(precedingYear / 4) -
    Math.floor(precedingYear / 100) +
    Math.floor(precedingYear / 400) +
    monthDays.slice(0, month - 1).reduce((a, b) => a + b, 0) +
    day -
    1;
  return days * 86400 + hour * 3600 + minute * 60 + second;
}

export function elapsedMinutes(from: string, to: string): number {
  return (localSeconds(to) - localSeconds(from)) / 60;
}

export function prepareObservations(readings: AnalysisReading[]): {
  observations: Observation[];
  invalidFindings: Finding[];
} {
  const invalidFindings: Finding[] = readings
    .filter((row) => row.status === 'INVALID')
    .map((row) => ({
      type: 'INVALID_READING',
      startedAt: row.recordedAt,
      endedAt: row.recordedAt,
      durationMinutes: null,
      peakTemperatureCelsius: null,
      details: {
        readingId: row.id,
        sourceRowNumber: row.sourceRowNumber,
        reason: row.validationError ?? 'Invalid reading',
      },
    }));
  const dated = readings
    .filter((row): row is AnalysisReading & { recordedAt: string } => row.recordedAt !== null)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  const observations: Observation[] = [];
  for (let i = 0; i < dated.length; ) {
    let end = i + 1;
    while (end < dated.length && dated[end].recordedAt === dated[i].recordedAt) end++;
    const group = dated.slice(i, end);
    const valid = group.filter((row) => row.status === 'VALID' && row.temperatureCelsius !== null);
    const values = new Set(valid.map((row) => row.temperatureCelsius));
    const intervals = new Set(group.map((row) => row.expectedIntervalMinutes));
    const conflict = values.size > 1 || intervals.size > 1;
    const reason = conflict
      ? 'CONFLICTING_OBSERVATION'
      : valid.length !== group.length
        ? 'INVALID_READING'
        : null;
    if (conflict)
      invalidFindings.push({
        type: 'INVALID_READING',
        startedAt: group[0].recordedAt,
        endedAt: group[0].recordedAt,
        durationMinutes: null,
        peakTemperatureCelsius: null,
        details: {
          readingIds: group.map((row) => row.id),
          reason: 'Conflicting values or sampling intervals at the same timestamp',
        },
      });
    observations.push({
      at: group[0].recordedAt,
      temperatureCelsius: reason ? null : valid[0].temperatureCelsius,
      expectedIntervalMinutes: Math.min(...group.map((row) => row.expectedIntervalMinutes)),
      interruptionReason: reason,
    });
    i = end;
  }
  return { observations, invalidFindings };
}
