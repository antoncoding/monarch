import { SupportedNetworks } from '@/utils/networks';

type EnvioIndexerConfig = {
  endpoint: string;
  apiKey?: string;
};

/**
 * Check if a network supports Morpho API as a data source
 */
export const supportsMorphoApi = (network: SupportedNetworks): boolean => {
  switch (network) {
    case SupportedNetworks.Mainnet:
    case SupportedNetworks.Base:
    case SupportedNetworks.Unichain:
    case SupportedNetworks.Polygon:
    case SupportedNetworks.Arbitrum:
    case SupportedNetworks.HyperEVM:
    case SupportedNetworks.Monad:
      return true;

    default:
      return false;
  }
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
