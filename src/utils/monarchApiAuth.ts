const VERCEL_PREVIEW_HOST_SUFFIX = '.vercel.app';
const MONARCH_PREVIEW_API_KEY = process.env.NEXT_PUBLIC_MONARCH_PREVIEW_API_KEY?.trim();

const isVercelPreviewHostname = (hostname: string): boolean => hostname.endsWith(VERCEL_PREVIEW_HOST_SUFFIX);

const isVercelPreviewRuntime = (): boolean => {
  if (typeof window !== 'undefined') {
    return isVercelPreviewHostname(window.location.hostname);
  }

  return process.env.VERCEL_ENV === 'preview';
};

export const getMonarchApiAuthHeaders = (): Record<string, string> => {
  if (!MONARCH_PREVIEW_API_KEY || !isVercelPreviewRuntime()) {
    return {};
  }

  return { 'X-API-Key': MONARCH_PREVIEW_API_KEY };
};
