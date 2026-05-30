import 'server-only';

const INTERNAL_ADMIN_HEADER = 'X-Internal-Admin-Key';

export async function callDataApiInternal(path: string, body: unknown): Promise<Response> {
  const adminKey = process.env.DATA_API_INTERNAL_ADMIN_KEY?.trim();
  if (!adminKey) {
    throw new Error('DATA_API_INTERNAL_ADMIN_KEY is not configured.');
  }

  const origin = (process.env.NEXT_PUBLIC_DATA_API_BASE_URL ?? '').replace(/\/+$/, '');
  if (!origin) {
    throw new Error('NEXT_PUBLIC_DATA_API_BASE_URL is not configured.');
  }

  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_ADMIN_HEADER]: adminKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}
