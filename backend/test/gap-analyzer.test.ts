import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareObservations, type Observation } from '../src/analysis/analysis.rules';
import { analyzeGaps } from '../src/analysis/gap-analyzer';

const point = (time: string, interval = 15): Observation => ({
  at: '2038-10-04T' + time + ':00',
  expectedIntervalMinutes: interval,
  temperatureCelsius: 4,
  interruptionReason: null,
});
test('15-minute snapshots produce a gap between 06:15 and 08:30', () => {
  const [gap] = analyzeGaps([point('06:15'), point('08:30')]);
  assert.equal(gap.durationMinutes, 135);
  assert.equal(gap.details.expectedIntervalMinutes, 15);
  assert.equal(gap.startedAt, '2038-10-04T06:15:00');
  assert.equal(gap.endedAt, '2038-10-04T08:30:00');
});
test('gap threshold is strict and uses custom intervals', () => {
  assert.equal(analyzeGaps([point('06:00'), point('06:30')]).length, 0);
  assert.equal(analyzeGaps([point('06:00'), point('06:31')]).length, 1);
  assert.equal(analyzeGaps([point('06:00', 10), point('06:20', 10)]).length, 0);
  assert.equal(analyzeGaps([point('06:00', 10), point('06:21', 10)]).length, 1);
});
test('interval transitions use the smaller neighboring snapshot', () => {
  assert.equal(
    analyzeGaps([point('06:00', 10), point('06:25', 15)])[0].details.expectedIntervalMinutes,
    10,
  );
});
test('dated ERR counts as an observation, while undated invalid rows cannot bound a gap', () => {
  const { observations, invalidFindings } = prepareObservations([
    {
      id: 'one',
      recordedAt: '2038-10-04T06:00:00',
      temperatureCelsius: 4,
      status: 'VALID',
      sourceRowNumber: 2,
      validationError: null,
      expectedIntervalMinutes: 15,
    },
    {
      id: 'err',
      recordedAt: '2038-10-04T06:15:00',
      temperatureCelsius: null,
      status: 'INVALID',
      sourceRowNumber: 3,
      validationError: 'ERR',
      expectedIntervalMinutes: 15,
    },
    {
      id: 'bad-time',
      recordedAt: null,
      temperatureCelsius: 4,
      status: 'INVALID',
      sourceRowNumber: 4,
      validationError: 'Invalid date',
      expectedIntervalMinutes: 15,
    },
    {
      id: 'last',
      recordedAt: '2038-10-04T06:45:00',
      temperatureCelsius: 4,
      status: 'VALID',
      sourceRowNumber: 5,
      validationError: null,
      expectedIntervalMinutes: 15,
    },
  ]);
  assert.equal(analyzeGaps(observations).length, 0);
  assert.equal(invalidFindings.length, 2);
});
test('no inferred gaps for zero or one observation', () => {
  assert.equal(analyzeGaps([]).length, 0);
  assert.equal(analyzeGaps([point('06:00')]).length, 0);
});
