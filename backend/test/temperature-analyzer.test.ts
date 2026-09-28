import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  elapsedMinutes,
  prepareObservations,
  type AnalysisReading,
} from '../src/analysis/analysis.rules';
import { analyzeTemperature } from '../src/analysis/temperature-analyzer';

const readings = (values: (number | null)[], interval = 15): AnalysisReading[] =>
  values.map((value, i) => ({
    id: 'reading-' + i,
    recordedAt: `2038-10-04T${String(6 + Math.floor((i * interval) / 60)).padStart(2, '0')}:${String((i * interval) % 60).padStart(2, '0')}:00`,
    temperatureCelsius: value,
    expectedIntervalMinutes: interval,
    status: value === null ? 'INVALID' : 'VALID',
    validationError: value === null ? 'ERR' : null,
    sourceRowNumber: i + 2,
  }));
const analyze = (rows: AnalysisReading[], ended = false) =>
  analyzeTemperature(prepareObservations(rows).observations, ended);

test('single recovered high is a spike, not a sustained incident', () => {
  const result = analyze(readings([4.1, 9.4, 4.3]));
  assert.equal(result.findings.length, 0);
  assert.equal(result.spikes.length, 1);
  assert.equal(result.spikes[0].recordedAt, '2038-10-04T06:15:00');
});
test('two or more highs start at first high, preserve peak and remain ongoing at end of data', () => {
  const [incident] = analyze(readings([4.6, 5.4, 6.3, 7.1])).findings;
  assert.equal(incident.startedAt, '2038-10-04T06:15:00');
  assert.equal(incident.peakTemperatureCelsius, 7.1);
  assert.equal(incident.details.state, 'ONGOING');
  assert.equal(incident.endedAt, null);
  assert.equal(incident.durationMinutes, null);
  assert.equal(incident.details.lastObservedHighAt, '2038-10-04T06:45:00');
});
test('recovery closes incident at <=5 and gives sampling-based 30 minute duration', () => {
  const [incident] = analyze(readings([4.6, 5.4, 6.3, 4.8])).findings;
  assert.equal(incident.endedAt, '2038-10-04T06:45:00');
  assert.equal(incident.durationMinutes, 30);
  assert.equal(incident.details.state, 'RECOVERED');
});
test('exactly 5 is not high, 5.01 is high, and isolated final high is not a spike', () => {
  assert.equal(analyze(readings([5, 5])).findings.length, 0);
  assert.equal(analyze(readings([5.01, 5.01])).findings.length, 1);
  const isolated = analyze(readings([5.01]));
  assert.equal(isolated.findings.length, 0);
  assert.equal(isolated.spikes.length, 0);
  assert.equal(analyze(readings([6, 7, 5])).findings[0].details.state, 'RECOVERED');
});
test('timestamped invalid reading interrupts, and highs on either side cannot form an incident', () => {
  assert.equal(analyze(readings([6, null, 7])).findings.length, 0);
  const result = analyze(readings([6, 7, null, 8, 9, 4]));
  assert.deepEqual(
    result.findings.map((row) => row.details.state),
    ['INTERRUPTED', 'RECOVERED'],
  );
  assert.equal(result.findings[0].details.interruptionReason, 'INVALID_READING');
  assert.equal(result.findings[0].durationMinutes, null);
  assert.equal(result.findings[0].endedAt, null);
});
test('missing expected reading interrupts even at exactly twice the expected interval', () => {
  const rows = readings([6, 7, 4]);
  rows[2].recordedAt = '2038-10-04T06:45:00';
  const [incident] = analyze(rows).findings;
  assert.equal(incident.details.state, 'INTERRUPTED');
  assert.equal(incident.durationMinutes, null);
  assert.equal(incident.details.interruptionReason, 'MISSING_EXPECTED_OBSERVATION');
  assert.equal(analyze([rows[0], rows[2]]).spikes.length, 0);
});
test('large gap separates two high runs', () => {
  const rows = readings([6, 7, 8, 9]);
  rows[2].recordedAt = '2038-10-04T08:30:00';
  rows[3].recordedAt = '2038-10-04T08:45:00';
  assert.deepEqual(
    analyze(rows).findings.map((row) => row.details.state),
    ['INTERRUPTED', 'ONGOING'],
  );
});
test('undated invalid evidence does not disable observable dated analysis', () => {
  const rows = readings([6, 7, 4, null]);
  rows[3].recordedAt = null;
  const prepared = prepareObservations(rows);
  assert.equal(prepared.invalidFindings[0].startedAt, null);
  const [incident] = analyzeTemperature(prepared.observations, false).findings;
  assert.equal(incident.details.state, 'RECOVERED');
  assert.equal(incident.durationMinutes, 30);
});
test('conflicting same-time values are one ambiguous point and break continuity', () => {
  const rows = readings([6, 7, 8, 9, 4]);
  rows[2].recordedAt = rows[1].recordedAt;
  const prepared = prepareObservations(rows);
  assert.equal(prepared.invalidFindings.length, 1);
  assert.match(String(prepared.invalidFindings[0].details.reason), /Conflicting/);
  assert.equal(analyzeTemperature(prepared.observations, false).findings.length, 0);
});
test('identical same-time observations do not count as two consecutive highs', () => {
  const rows = readings([6, 6]);
  rows[1].recordedAt = rows[0].recordedAt;
  assert.equal(analyze(rows).findings.length, 0);
});
test('a valid high and ERR at the same timestamp preserve invalid evidence and interrupt high runs', () => {
  const rows = readings([6, 7, 9, null, 8]);
  rows[3].recordedAt = rows[2].recordedAt;
  rows[4].recordedAt = '2038-10-04T06:45:00';
  const prepared = prepareObservations(rows);
  assert.equal(prepared.invalidFindings.length, 1);
  assert.equal(prepared.invalidFindings[0].type, 'INVALID_READING');
  assert.equal(prepared.invalidFindings[0].startedAt, '2038-10-04T06:30:00');
  assert.equal(prepared.invalidFindings[0].details.readingId, rows[3].id);
  assert.equal(prepared.invalidFindings[0].details.reason, 'ERR');

  const result = analyzeTemperature(prepared.observations, false);
  assert.equal(result.findings.length, 1);
  const [incident] = result.findings;
  assert.equal(incident.details.state, 'INTERRUPTED');
  assert.equal(incident.details.interruptionReason, 'INVALID_READING');
  assert.equal(incident.details.lastObservedHighAt, '2038-10-04T06:15:00');
  assert.equal(incident.peakTemperatureCelsius, 7);
  assert.equal(incident.endedAt, null);
  assert.equal(incident.durationMinutes, null);
  // With only one preceding high, the ambiguous point cannot create a run either.
  assert.equal(analyzeTemperature(prepared.observations.slice(1), false).findings.length, 0);
});
test('sampling interval change interrupts even when observations are close', () => {
  const rows = readings([6, 7, 8, 9], 10);
  rows[2].expectedIntervalMinutes = 15;
  rows[3].expectedIntervalMinutes = 15;
  const result = analyze(rows);
  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[0].details.interruptionReason, 'INTERVAL_CHANGED');
});
test('closed assignment cannot leave a claim of ongoing warming', () => {
  const [incident] = analyze(readings([6, 7]), true).findings;
  assert.equal(incident.details.state, 'INTERRUPTED');
  assert.equal(incident.details.interruptionReason, 'ASSIGNMENT_ENDED');
});
test('local elapsed arithmetic preserves midnight, leap dates, years and seconds', () => {
  assert.equal(elapsedMinutes('2040-02-28T23:50:00', '2040-02-29T00:10:00'), 20);
  assert.equal(elapsedMinutes('2039-02-28T23:50:00', '2039-03-01T00:10:00'), 20);
  assert.equal(elapsedMinutes('2039-12-31T23:50:00', '2040-01-01T00:10:30'), 20.5);
  const rows = readings([6, 7, 4]);
  rows[0].recordedAt = '2039-12-31T23:45:00';
  rows[1].recordedAt = '2040-01-01T00:00:00';
  rows[2].recordedAt = '2040-01-01T00:15:00';
  assert.equal(analyze(rows).findings[0].durationMinutes, 30);
});
