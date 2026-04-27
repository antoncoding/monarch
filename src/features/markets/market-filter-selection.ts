import { toChainAssetKey } from '@/utils/chain-asset-key';
import type { SupportedNetworks } from '@/utils/supported-networks';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';

export type MarketFilterAsset = ERC20Token | UnknownERC20Token;

export type MarketFilterTokenSelector =
  | {
      address: string;
      chainId: SupportedNetworks;
      kind: 'chain-address';
    }
  | {
      kind: 'symbol';
      symbol: string;
    };

export const getMarketFilterAssetSelectionKey = (token: MarketFilterAsset): string => {
  return token.networks.map((network) => toChainAssetKey(network.address, network.chain.id)).join('|');
};

export const marketFilterSelectionIncludesAsset = (selectionKey: string, address: string, chainId: number): boolean => {
  return selectionKey.split('|').includes(toChainAssetKey(address, chainId));
};

const matchesTokenSelector = (token: MarketFilterAsset, selector: MarketFilterTokenSelector): boolean => {
  if (selector.kind === 'symbol') {
    return token.symbol.toLowerCase() === selector.symbol;
  }

  return token.networks.some((network) => network.chain.id === selector.chainId && network.address.toLowerCase() === selector.address);
};

export const resolveMarketFilterTokenSelectors = (selectors: MarketFilterTokenSelector[], items: MarketFilterAsset[]): string[] => {
  const selectedKeys = new Set<string>();

  for (const selector of selectors) {
    for (const item of items) {
      if (matchesTokenSelector(item, selector)) {
        selectedKeys.add(getMarketFilterAssetSelectionKey(item));
      }
    }
  }

  return [...selectedKeys];
};
