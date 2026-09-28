import { parse } from 'csv-parse/sync';
import { mapColumns } from './column-mapping';
import type { RawReading } from './import.types';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 10000;

export function parseLoggerCsv(bytes: Buffer): RawReading[] {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error('Supply a nonempty CSV of at most 2 MiB.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('CSV must be UTF-8 encoded.'); }
  if (text.includes('\0')) throw new Error('CSV contains a NUL character.');
  // Strict record widths and quoting. Empty physical lines are ignored, not data rows.
  const records = parse(text, {
    bom: true, info: true, skip_empty_lines: true, max_record_size: 16384,
  }) as unknown as { record: string[]; info: { bytes: number } }[];
  if (records.length < 2) throw new Error('CSV must contain a header and at least one data row.');
  if (records.length - 1 > MAX_ROWS) throw new Error(`CSV exceeds ${MAX_ROWS} data rows.`);
  const mapping = mapColumns(records[0].record);
  const source = Buffer.from(text, 'utf8');
  let offset = 0;
  let line = 1;
  return records.map(({ record, info }) => {
    // Byte boundaries preserve physical lines even where the library counts CRLF
    // inside quoted fields as two lines. Never reconstruct source text from cells.
    const fragment = source.subarray(offset, info.bytes).toString('utf8');
    const leading = /^(?:\r\n|\n|\r)*/.exec(fragment)![0];
    const sourceRowNumber = line + (leading.match(/\r\n|\n|\r/g) ?? []).length;
    line += (fragment.match(/\r\n|\n|\r/g) ?? []).length;
    offset = info.bytes;
    return {
      sourceRowNumber,
      rawTimestamp: record[mapping.timestamp], rawTemperature: record[mapping.temperature],
    };
  }).slice(1);
}
