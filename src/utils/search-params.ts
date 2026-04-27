export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export const serializeSearchParamsRecord = (searchParams: SearchParamsRecord): string => {
  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        nextSearchParams.append(key, entry);
      }
      continue;
    }

    nextSearchParams.set(key, value);
  }

  return nextSearchParams.toString();
};
