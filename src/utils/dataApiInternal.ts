import 'server-only';

const INTERNAL_ADMIN_HEADER = 'X-Internal-Admin-Key';
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;

export async function callDataApiInternal(path: string, body: unknown): Promise<Response> {
  const adminKey = process.env.DATA_API_INTERNAL_ADMIN_KEY?.trim();
  if (!adminKey) {
    throw new Error('DATA_API_INTERNAL_ADMIN_KEY is not configured.');
  }

  const origin = getInternalOrigin();

  return fetch(new URL(path, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_ADMIN_HEADER]: adminKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

function getInternalOrigin(): string {
  const configuredOrigin = process.env.DATA_API_INTERNAL_ORIGIN?.trim().replace(/\/+$/, '');
  if (!configuredOrigin) {
    throw new Error('DATA_API_INTERNAL_ORIGIN is not configured.');
  }

  const candidate = URL_SCHEME_PATTERN.test(configuredOrigin) ? configuredOrigin : `https://${configuredOrigin}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unsupported protocol.');
    }
    return url.origin;
  } catch {
    throw new Error('DATA_API_INTERNAL_ORIGIN is invalid.');
  }
}
