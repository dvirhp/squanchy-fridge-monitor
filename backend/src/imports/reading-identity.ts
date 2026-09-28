import type { TemperatureUnit } from '@prisma/client';
import type { ValidatedReading } from './import.types';

export function readingIdentity(row: ValidatedReading, context: {
  loggerId: string; fridgeId: string; temperatureUnit: TemperatureUnit;
}): string {
  return row.status === 'VALID'
    ? JSON.stringify([1, 'VALID', context.loggerId, row.recordedAt, row.temperatureCelsius])
    : JSON.stringify([1, 'INVALID', context.loggerId, context.fridgeId, context.temperatureUnit, row.rawTimestamp, row.rawTemperature]);
}
