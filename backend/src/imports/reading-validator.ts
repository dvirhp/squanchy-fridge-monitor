import type { NormalizedReading, ValidatedReading } from './import.types';

export function validateReading(row: NormalizedReading): ValidatedReading {
  const errors: string[] = [];
  if (row.recordedAt === null) errors.push('Invalid local timestamp: use YYYY-MM-DD HH:mm or DD/MM/YYYY HH:mm with a valid calendar date.');
  if (row.temperatureCelsius === null) errors.push('Invalid temperature: expected a finite decimal number in the configured unit.');
  return { ...row, status: errors.length ? 'INVALID' : 'VALID', validationError: errors.length ? errors.join(' ') : null };
}
