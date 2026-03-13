const shouldLogDataSourceEvents = (): boolean => {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_DATA_SOURCES === 'true';
};

const formatDetails = (details: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!details) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
};

export const logDataSourceEvent = (
  scope: string,
  message: string,
  details?: Record<string, unknown>,
): void => {
  if (!shouldLogDataSourceEvents()) {
    return;
  }

  const formattedDetails = formatDetails(details);

  if (formattedDetails) {
    console.info(`[data-source:${scope}] ${message}`, formattedDetails);
    return;
  }

  console.info(`[data-source:${scope}] ${message}`);
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
};
