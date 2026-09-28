export const HEADER_ALIASES = {
  timestamp: ['time', 'timestamp', 'datetime'],
  temperature: ['temperature', 'temp'],
} as const;

export function mapColumns(headers: string[]) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  const locate = (field: keyof typeof HEADER_ALIASES) => {
    const matches = normalized.flatMap((header, index) =>
      (HEADER_ALIASES[field] as readonly string[]).includes(header) ? [index] : [],
    );
    if (matches.length !== 1)
      throw new Error(
        matches.length
          ? `Ambiguous ${field} columns. Supply exactly one supported alias.`
          : `Missing ${field} column. Supported aliases: ${HEADER_ALIASES[field].join(', ')}.`,
      );
    return matches[0];
  };
  return { timestamp: locate('timestamp'), temperature: locate('temperature') };
}
