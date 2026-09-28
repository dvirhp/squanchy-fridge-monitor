export async function getHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('The backend is unavailable.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('status' in result) || result.status !== 'ok') {
    throw new Error('Unexpected health response.');
  }
}
