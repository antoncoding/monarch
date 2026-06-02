export const URLS = {
  MORPHO_BLUE_API: 'https://blue-api.morpho.org/graphql',
} as const;

export const DATA_API_BASE_URL = process.env.NEXT_PUBLIC_DATA_API_BASE_URL?.replace(/\/+$/, '') ?? '';
