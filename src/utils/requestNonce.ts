export function createRequestNonce() {
  if (typeof crypto === 'undefined') {
    return createFallbackNonce();
  }

  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  if (typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return createFallbackNonce();
}

function createFallbackNonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2).padEnd(16, '0')}`;
}
