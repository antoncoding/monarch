import { getNetworkName, SupportedNetworks, getExplorerUrl } from './networks';

export const getMarketURL = (id: string, chainId: number): string => {
  const network =
    chainId === SupportedNetworks.Mainnet ? 'ethereum' : getNetworkName(chainId)?.toLowerCase();
  return `https://app.morpho.org/${network}/market/${id}`;
};

export const getAssetURL = (address: string, chain: SupportedNetworks): string => {
  return `${getExplorerUrl(chain)}/token/${address}`;
};

export const getExplorerURL = (address: string, chain: SupportedNetworks): string => {
  return `${getExplorerUrl(chain)}/address/${address}`;
};

export const getExplorerTxURL = (hash: string, chain: SupportedNetworks): string => {
  return `${getExplorerUrl(chain)}/tx/${hash}`;
};

const getChainNameForMerkl = (chainId: number): string => {
  switch (chainId) {
    case SupportedNetworks.Mainnet:
      return 'ethereum';
    case SupportedNetworks.Base:
      return 'base';
    case SupportedNetworks.Polygon:
      return 'polygon';
    case SupportedNetworks.Unichain:
      return 'unichain';
    case SupportedNetworks.Arbitrum:
      return 'arbitrum';
    case SupportedNetworks.HyperEVM:
      return 'hyperevm';
    default:
      return 'ethereum';
  }
};

export const getMerklCampaignURL = (chainId: number, type: string, identifier: string): string => {
  const chainName = getChainNameForMerkl(chainId);
  return `https://app.merkl.xyz/opportunities/${chainName}/${type}/${identifier}`;
};

export const EXTERNAL_LINKS = {
  docs: 'https://monarch-lend.gitbook.io/monarch-lend/',
  discord: 'https://discord.gg/Ur4dwN3aPS',
  github: 'https://github.com/monarch-xyz',
} as const;
