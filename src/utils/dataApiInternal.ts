import 'server-only';

const INTERNAL_ADMIN_HEADER = 'X-Internal-Admin-Key';
const INTERNAL_REQUEST_TIMEOUT_MS = 10_000;

export async function callDataApiInternal(path: string, body: unknown): Promise<Response> {
  const origin = process.env.DATA_API_INTERNAL_ORIGIN?.trim().replace(/\/+$/, '');
  const adminKey = process.env.DATA_API_INTERNAL_ADMIN_KEY?.trim();

  if (!origin || !adminKey) {
    throw new Error('Data API internal access is not configured.');
  }

  return fetch(new URL(path, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_ADMIN_HEADER]: adminKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(INTERNAL_REQUEST_TIMEOUT_MS),
  });
}
