import { type MarketFilterTokenSelector, type MarketFilterAsset, resolveMarketFilterTokenSelectors } from './market-filter-selection';
import { SupportedNetworks, isSupportedNetwork } from '@/utils/supported-networks';

type SearchParamsLike = Pick<URLSearchParams, 'get' | 'getAll' | 'has'>;

export type MarketFilterUrlState = {
  selectedCollateralSelectors?: MarketFilterTokenSelector[];
  selectedLoanSelectors?: MarketFilterTokenSelector[];
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

const splitSearchParamValues = (searchParams: SearchParamsLike, key: string): string[] => {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
};

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

export const parseMarketFilterTokenSelector = (rawValue: string): MarketFilterTokenSelector | null => {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = normalizeParamValue(trimmedValue);
  if (CLEAR_VALUES.has(normalizedValue)) {
    return null;
  }

  if (normalizedValue.startsWith('symbol:')) {
    const symbol = normalizeParamValue(trimmedValue.slice(trimmedValue.indexOf(':') + 1));
    return symbol ? { kind: 'symbol', symbol } : null;
  }

  const [networkOrChainId, address] = trimmedValue.split(':', 2);
  if (address) {
    const chainId = resolveSupportedNetworkPreference(networkOrChainId);
    if (chainId === null || chainId === undefined || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return null;
    }

    return {
      kind: 'chain-address',
      chainId,
      address: address.toLowerCase(),
    };
  }

  return {
    kind: 'symbol',
    symbol: normalizedValue,
  };
};

const parseTokenSelectorsParam = (searchParams: SearchParamsLike, key: string): MarketFilterTokenSelector[] | undefined => {
  if (!searchParams.has(key)) {
    return undefined;
  }

  const rawValues = splitSearchParamValues(searchParams, key);
  if (rawValues.length === 0 || rawValues.some((value) => CLEAR_VALUES.has(normalizeParamValue(value)))) {
    return [];
  }

  const selectors = rawValues
    .map((value) => parseMarketFilterTokenSelector(value))
    .filter((value): value is MarketFilterTokenSelector => value !== null);

  return selectors.length > 0 ? selectors : undefined;
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

const serializeTokenSelector = (selector: MarketFilterTokenSelector): string => {
  if (selector.kind === 'symbol') {
    return `symbol:${selector.symbol}`;
  }

  return `${selector.chainId}:${selector.address}`;
};

const createMarketFilterUrlStateSignature = (state: Omit<MarketFilterUrlState, 'signature'>): string | null => {
  const signatureParts: string[] = [];

  if (state.selectedNetwork !== undefined) {
    signatureParts.push(`network:${state.selectedNetwork ?? 'all'}`);
  }

  if (state.selectedLoanSelectors !== undefined) {
    const serializedLoanSelectors = state.selectedLoanSelectors.map(serializeTokenSelector).sort().join(',');
    signatureParts.push(`loan:${serializedLoanSelectors || 'all'}`);
  }

  if (state.selectedCollateralSelectors !== undefined) {
    const serializedCollateralSelectors = state.selectedCollateralSelectors.map(serializeTokenSelector).sort().join(',');
    signatureParts.push(`collateral:${serializedCollateralSelectors || 'all'}`);
  }

  return signatureParts.length > 0 ? signatureParts.join('|') : null;
};

export const parseMarketFilterUrlState = (searchParams: SearchParamsLike): MarketFilterUrlState => {
  const explicitNetworkPreference = parseExplicitNetworkPreference(searchParams);

  const nextState: Omit<MarketFilterUrlState, 'signature'> = {
    selectedNetwork: explicitNetworkPreference ?? resolveReferralNetworkPreference(searchParams),
    selectedLoanSelectors: parseTokenSelectorsParam(searchParams, 'loan'),
    selectedCollateralSelectors: parseTokenSelectorsParam(searchParams, 'collateral'),
  };

  return {
    ...nextState,
    signature: createMarketFilterUrlStateSignature(nextState),
  };
};

export const resolveMarketFilterSelectionsFromUrlState = (
  selectors: MarketFilterTokenSelector[] | undefined,
  items: MarketFilterAsset[],
): string[] | undefined => {
  if (selectors === undefined) {
    return undefined;
  }

  if (selectors.length === 0) {
    return [];
  }

  return resolveMarketFilterTokenSelectors(selectors, items);
};
