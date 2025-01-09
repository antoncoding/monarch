import { SupportedNetworks } from './networks';

export const getMarketURL = (id: string, chainId: number): string => {
  const chain = chainId === 1 ? 'mainnet' : 'base';
  return `https://app.morpho.org/market?id=${id}&network=${chain}`;
};

export const getAssetURL = (address: string, chain: SupportedNetworks): string => {
  switch (chain) {
    case SupportedNetworks.Base:
      return `https://basescan.org/token/${address}`;
    default:
      return `https://etherscan.io/token/${address}`;
  }
};

export const getExplorerURL = (address: string, chain: SupportedNetworks): string => {
  switch (chain) {
    case SupportedNetworks.Base:
      return `https://basescan.org/address/${address}`;
    default:
      return `https://etherscan.io/address/${address}`;
  }
};

export const getExplorerTxURL = (hash: string, chain: SupportedNetworks): string => {
  switch (chain) {
    case SupportedNetworks.Base:
      return `https://basescan.org/tx/${hash}`;
    default:
      return `https://etherscan.io/tx/${hash}`;
  }
};

export const EXTERNAL_LINKS = {
  docs: 'https://monarch-lend.gitbook.io/monarch-lend/',
  discord: 'https://discord.gg/Ur4dwN3aPS',
  github: 'https://github.com/monarch-xyz',
} as const;
