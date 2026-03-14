type EnvioIndexerConfig = {
  endpoint: string;
  apiKey?: string;
};

const getTrimmedEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getEnvioIndexerConfig = (): EnvioIndexerConfig | null => {
  const endpoint = getTrimmedEnv(process.env.NEXT_PUBLIC_ENVIO_INDEXER_ENDPOINT);

  if (!endpoint) {
    return null;
  }

  const apiKey = getTrimmedEnv(process.env.NEXT_PUBLIC_ENVIO_INDEXER_API_KEY);

  return {
    endpoint,
    apiKey,
  };
};

export const hasEnvioIndexer = (): boolean => {
  return getEnvioIndexerConfig() !== null;
};
