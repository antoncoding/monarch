const MONARCH_PREVIEW_API_KEY = process.env.NEXT_PUBLIC_MONARCH_PREVIEW_API_KEY?.trim();

export const getMonarchApiAuthHeaders = (): Record<string, string> => {
  if (!MONARCH_PREVIEW_API_KEY) {
    return {};
  }

  return { 'X-API-Key': MONARCH_PREVIEW_API_KEY };
};
