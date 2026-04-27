import { SupportedNetworks, isSupportedNetwork } from '@/utils/supported-networks';

type SearchParamsLike = Pick<URLSearchParams, 'get' | 'has'>;

export type MarketFilterUrlState = {
  selectedNetwork?: SupportedNetworks | null;
  signature: string | null;
};

const CLEAR_VALUES = new Set(['all', 'clear', 'none']);

const NETWORK_ALIASES: Record<string, SupportedNetworks> = {
  arb: SupportedNetworks.Arbitrum,
  arbitrum: SupportedNetworks.Arbitrum,
  base: SupportedNetworks.Base,
  etherlink: SupportedNetworks.Etherlink,
  ethereum: SupportedNetworks.Mainnet,
  eth: SupportedNetworks.Mainnet,
  'hyper-evm': SupportedNetworks.HyperEVM,
  hyperevm: SupportedNetworks.HyperEVM,
  mainnet: SupportedNetworks.Mainnet,
  monad: SupportedNetworks.Monad,
  op: SupportedNetworks.Optimism,
  optimism: SupportedNetworks.Optimism,
  polygon: SupportedNetworks.Polygon,
  unichain: SupportedNetworks.Unichain,
};

const REF_NETWORK_ALIASES: Record<string, SupportedNetworks> = {
  etherlink: SupportedNetworks.Etherlink,
};

const normalizeParamValue = (value: string): string => value.trim().toLowerCase();

export const resolveSupportedNetworkPreference = (rawValue: string): SupportedNetworks | null | undefined => {
  const normalizedValue = normalizeParamValue(rawValue);

  if (!normalizedValue) {
    return undefined;
  }

  if (CLEAR_VALUES.has(normalizedValue)) {
    return null;
  }

  if (/^\d+$/.test(normalizedValue)) {
    const chainId = Number(normalizedValue);
    return isSupportedNetwork(chainId) ? chainId : undefined;
  }

  return NETWORK_ALIASES[normalizedValue];
};

const parseExplicitNetworkPreference = (searchParams: SearchParamsLike): SupportedNetworks | null | undefined => {
  for (const key of ['network', 'chain']) {
    if (!searchParams.has(key)) {
      continue;
    }

    const value = searchParams.get(key);
    if (!value) {
      continue;
    }

    const resolvedNetwork = resolveSupportedNetworkPreference(value);
    if (resolvedNetwork !== undefined) {
      return resolvedNetwork;
    }
  }

  return undefined;
};

const resolveReferralNetworkPreference = (searchParams: SearchParamsLike): SupportedNetworks | undefined => {
  const refValue = searchParams.get('ref');
  if (!refValue) {
    return undefined;
  }

  return REF_NETWORK_ALIASES[normalizeParamValue(refValue)];
};

const createMarketFilterUrlStateSignature = (state: Omit<MarketFilterUrlState, 'signature'>): string | null => {
  if (state.selectedNetwork === undefined) {
    return null;
  }

  return `network:${state.selectedNetwork ?? 'all'}`;
};

export const parseMarketFilterUrlState = (searchParams: SearchParamsLike): MarketFilterUrlState => {
  const nextState: Omit<MarketFilterUrlState, 'signature'> = {
    selectedNetwork: parseExplicitNetworkPreference(searchParams) ?? resolveReferralNetworkPreference(searchParams),
  };

  return {
    ...nextState,
    signature: createMarketFilterUrlStateSignature(nextState),
  };
};
