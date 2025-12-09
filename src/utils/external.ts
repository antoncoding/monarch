import { getNetworkName, SupportedNetworks, getExplorerUrl } from './networks';

const getMorphoNetworkSlug = (chainId: number): string | undefined => {
  const network = getNetworkName(chainId)?.toLowerCase();
  if (chainId === SupportedNetworks.HyperEVM) {
    return 'hyperevm';
  }
  if (chainId === SupportedNetworks.Mainnet) {
    return 'ethereum';
  }
  return network;
};

export const getMarketURL = (id: string, chainId: number): string => {
  const network = getMorphoNetworkSlug(chainId);
  return `https://app.morpho.org/${network}/market/${id}`;
};

export const getVaultURL = (address: string, chainId: number): string => {
  const network = getMorphoNetworkSlug(chainId);
  return `https://app.morpho.org/${network}/vault/${address}`;
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
    case SupportedNetworks.Monad:
      return 'monad';
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
