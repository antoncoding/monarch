export const normalizeEnvioString = (value: string | number | null | undefined): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return '0';
};

export const normalizeEnvioTimestamp = (value: string | number | null | undefined): number => {
  const normalizedValue = normalizeEnvioString(value);

  try {
    return Number(BigInt(normalizedValue));
  } catch {
    return 0;
  }
};

export const fetchAllEnvioPages = async <T>({
  fetchPage,
  maxItems = 1000,
  pageSize = 500,
}: {
  fetchPage: (limit: number, offset: number) => Promise<T[]>;
  maxItems?: number;
  pageSize?: number;
}): Promise<T[]> => {
  const items: T[] = [];

  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const remainingItems = maxItems - items.length;
    const limit = Math.min(pageSize, remainingItems);
    const page = await fetchPage(limit, offset);

    if (page.length === 0) {
      break;
    }

    items.push(...page);

    if (page.length < limit || items.length >= maxItems) {
      break;
    }
  }

  return items;
};
