export interface Branch { id: string; name: string; fridges: { id: string; name: string }[] }
export interface Logger { id: string; externalId: string; temperatureUnit: string; expectedIntervalMinutes: number;
  assignments: { id: string; fridgeId: string; validFrom: string; validTo: string | null }[] }
export interface ImportOptions { branches: Branch[]; loggers: Logger[] }
export interface FridgeSummary { id: string; name: string; branch: { id: string; name: string }; status: string;
  temperatureCount: number; qualityCount: number; undatedCount: number;
  latestReading: { recordedAt: string; temperatureCelsius: number } | null; latestUploadedAt: string | null }
export interface DashboardData { counts: { total: number; temperature: number; quality: number; clear: number; noData: number }; fridges: FridgeSummary[] }
export interface Reading { id: string; recordedAt: string; temperatureCelsius: number | null; status: string;
  validationError: string | null; loggerId: string; loggerExternalId: string; assignmentId: string; expectedIntervalMinutes: number }
export interface Finding { id: string; type: string; startedAt: string | null; endedAt: string | null;
  durationMinutes: number | null; peakTemperatureCelsius: number | null; details: Record<string, string | number | string[]> | null }
export interface FridgeData { id: string; name: string; branch: { id: string; name: string }; readings: Reading[];
  temperatureIncidents: Finding[]; dataQuality: Finding[]; undatedQuality: Finding[] }
export interface ImportResult { importId: string; fridgeId: string; acceptedRows: number; invalidRows: number; duplicateRows: number;
  analysis: { temperatureIncidents: number; dataGaps: number; invalidReadings: number; temporarySpikes: number } }
