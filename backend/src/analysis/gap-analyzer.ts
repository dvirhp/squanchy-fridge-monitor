import { ANALYSIS_RULES, elapsedMinutes, type Finding, type Observation } from './analysis.rules';

export function analyzeGaps(observations: Observation[]): Finding[] {
  const findings: Finding[] = [];
  for (let i = 1; i < observations.length; i++) {
    const previous = observations[i - 1];
    const next = observations[i];
    const elapsed = elapsedMinutes(previous.at, next.at);
    // Historical imports can have different configurations. Use the smaller
    // neighboring snapshot interval conservatively; never the live logger setting.
    const expected = Math.min(previous.expectedIntervalMinutes, next.expectedIntervalMinutes);
    if (elapsed > ANALYSIS_RULES.gapIntervalMultiplier * expected) findings.push({
      type: 'DATA_GAP', startedAt: previous.at, endedAt: next.at,
      durationMinutes: elapsed, peakTemperatureCelsius: null,
      details: { previousObservationAt: previous.at, nextObservationAt: next.at,
        elapsedMinutes: elapsed, expectedIntervalMinutes: expected },
    });
  }
  return findings;
}
