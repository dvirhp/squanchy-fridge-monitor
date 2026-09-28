import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLoggerCsv } from '../src/imports/csv-parser';

const parse = (text: string) => parseLoggerCsv(Buffer.from(text));

test('aliases, casing, whitespace, reversed columns, BOM, CRLF and quotes', () => {
  const rows = parse('\ufeff TeMp , DATETIME \r\n" 4.1 ","14/09/2026 06:00"\r\n');
  assert.deepEqual(rows, [
    { sourceRowNumber: 2, rawTemperature: ' 4.1 ', rawTimestamp: '14/09/2026 06:00' },
  ]);
});
test('preserves physical source lines including blank and multiline records', () => {
  const rows = parse('Time,Temperature\n\n"bad\ntime",ERR\n2031-01-01 00:00,4\n');
  assert.equal(rows[0].sourceRowNumber, 3);
  assert.equal(rows[0].rawTimestamp, 'bad\ntime');
  assert.equal(rows[1].sourceRowNumber, 5);
  const windows = parse('Time,Temp\r\n\r\n"bad\r\ntime",ERR\r\n2031-01-01 00:00,4\r\n');
  assert.deepEqual(
    windows.map((row) => row.sourceRowNumber),
    [3, 5],
  );
});
test('rejects missing, duplicate, and ambiguous semantic columns', () => {
  for (const text of [
    'Time,Humidity\na,2',
    'Time,Timestamp,Temp\na,a,2',
    'Time,Temp,Temperature\na,2,2',
    'Time,Time,Temp\na,a,2',
  ]) {
    assert.throws(() => parse(text), /Missing|Ambiguous/);
  }
});
test('malformed syntax, record widths, empty files, invalid UTF-8 and NUL fail', () => {
  for (const text of [
    '',
    'Time,Temp\n',
    'Time,Temp\n"broken,4',
    'Time,Temp\na,4,extra',
    'Time,Temp\na',
    'Time,Temp\na,\0',
  ]) {
    assert.throws(() => parse(text));
  }
  assert.throws(() => parseLoggerCsv(Buffer.from([0xff])), /UTF-8/);
});
