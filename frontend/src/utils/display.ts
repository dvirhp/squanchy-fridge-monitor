export const dateTime = (value: string | null | undefined) => value ? value.replace('T', ' ').slice(0, 16) : 'Date unknown';
export const temperature = (value: number) => `${Number(value.toFixed(2))}°C`;
export function localMinutes(timestamp: string): number {
  const [year, month, day, hour, minute, second = 0] = timestamp.split(/[-T:]/).map(Number);
  const y = year - 1;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const months = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)
    + months.slice(0, month - 1).reduce((a, b) => a + b, 0) + day - 1;
  return days * 1440 + hour * 60 + minute + second / 60;
}
export function dateQuery(params: URLSearchParams) {
  const result = new URLSearchParams();
  for (const key of ['from', 'to']) if (params.get(key)) result.set(key, params.get(key)!);
  return result.toString();
}
