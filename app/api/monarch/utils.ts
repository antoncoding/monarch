export const MONARCH_API_ENDPOINT = process.env.MONARCH_API_ENDPOINT;
export const MONARCH_API_KEY = process.env.MONARCH_API_KEY;

export const getMonarchUrl = (path: string): URL => {
  if (!MONARCH_API_ENDPOINT) throw new Error('MONARCH_API_ENDPOINT not configured');
  return new URL(path, MONARCH_API_ENDPOINT.replace(/\/$/, ''));
};
