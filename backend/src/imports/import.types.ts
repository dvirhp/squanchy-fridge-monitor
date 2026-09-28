import type { ReadingStatus } from '@prisma/client';
export interface RawReading { sourceRowNumber: number; rawTimestamp: string; rawTemperature: string }
export interface NormalizedReading extends RawReading {
  recordedAt: string | null; temperatureCelsius: number | null;
}
export interface ValidatedReading extends NormalizedReading {
  status: ReadingStatus; validationError: string | null;
}
export interface ImportSummary {
  importId: string; assignmentId: string; totalRows: number;
  acceptedRows: number; invalidRows: number; duplicateRows: number;
}
