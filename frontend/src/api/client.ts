export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, options); }
  catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new Error('Cannot connect. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(message ?? (response.status === 413 ? 'This file is too large. Choose a CSV smaller than 2 MB.' : 'The request failed. Please try again.'));
  }
  return response.json() as Promise<T>;
}
