import { ANALYSIS_RULES, elapsedMinutes, type Finding, type Observation } from './analysis.rules';

export function analyzeTemperature(observations: Observation[], assignmentEnded: boolean) {
  const findings: Finding[] = [];
  const spikes: { recordedAt: string; recoveredAt: string; temperatureCelsius: number }[] = [];
  let run: { start: string; last: string; count: number; peak: number } | null = null;
  const finish = (state: 'RECOVERED' | 'ONGOING' | 'INTERRUPTED', recovery: string | null = null, reason?: string) => {
    if (run && run.count >= ANALYSIS_RULES.sustainedReadings) findings.push({
      type: 'TEMPERATURE', startedAt: run.start, endedAt: recovery,
      durationMinutes: recovery === null ? null : elapsedMinutes(run.start, recovery),
      peakTemperatureCelsius: run.peak,
      details: { state, lastObservedHighAt: run.last, ...(reason ? { interruptionReason: reason } : {}) },
    });
    else if (run && state === 'RECOVERED' && recovery) spikes.push({
      recordedAt: run.start, recoveredAt: recovery, temperatureCelsius: run.peak,
    });
    run = null;
  };
  let previous: Observation | undefined;
  for (const observation of observations) {
    if (previous) {
      if (previous.expectedIntervalMinutes !== observation.expectedIntervalMinutes) {
        finish('INTERRUPTED', null, 'INTERVAL_CHANGED');
      } else if (elapsedMinutes(previous.at, observation.at) > previous.expectedIntervalMinutes) {
        finish('INTERRUPTED', null, 'MISSING_EXPECTED_OBSERVATION');
      }
    }
    if (observation.interruptionReason || observation.temperatureCelsius === null) {
      finish('INTERRUPTED', null, observation.interruptionReason ?? 'INVALID_READING');
    } else if (observation.temperatureCelsius > ANALYSIS_RULES.highTemperatureCelsius) {
      if (run) {
        run.last = observation.at; run.count++; run.peak = Math.max(run.peak, observation.temperatureCelsius);
      } else {
        run = { start: observation.at, last: observation.at, count: 1, peak: observation.temperatureCelsius };
      }
    } else {
      finish('RECOVERED', observation.at);
    }
    previous = observation;
  }
  if (assignmentEnded) finish('INTERRUPTED', null, 'ASSIGNMENT_ENDED');
  else finish('ONGOING');
  return { findings, spikes };
}
