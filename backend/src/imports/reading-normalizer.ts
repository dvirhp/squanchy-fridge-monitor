import { TemperatureUnit } from '@prisma/client';
import Decimal from 'decimal.js';
import type { NormalizedReading, RawReading } from './import.types';

export function normalizeTimestamp(raw: string): string | null {
  const value = raw.trim();
  let parts: string[] | null = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!parts) {
    const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (dayFirst) parts = [dayFirst[0], dayFirst[3], dayFirst[2], dayFirst[1], dayFirst[4], dayFirst[5], dayFirst[6]];
  }
  if (!parts) return null;
  const [, year, month, day, hour, minute, second = '00'] = parts;
  const [y, m, d, h, min, s] = [year, month, day, hour, minute, second].map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1] || h > 23 || min > 59 || s > 59) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function normalizeReading(row: RawReading, unit: TemperatureUnit): NormalizedReading {
  const text = row.rawTemperature.trim();
  let temperatureCelsius: number | null = null;
  // Decimal notation only; no partial parse, units, exponent, hex, NaN, or Infinity.
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    const decimal = new Decimal(text);
    const value = (unit === 'FAHRENHEIT' ? decimal.minus(32).times(5).dividedBy(9) : decimal).toNumber();
    if (Number.isFinite(value)) temperatureCelsius = Object.is(value, -0) ? 0 : value;
  }
  return { ...row, recordedAt: normalizeTimestamp(row.rawTimestamp), temperatureCelsius };
}
