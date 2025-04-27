import { zeroAddress } from 'viem';
import { SupportedNetworks } from './networks';
import { UserTxTypes } from './types';

// export const MORPHO = '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';

// appended to the end of datahash to identify a monarch tx
export const MONARCH_TX_IDENTIFIER = 'beef';

export const getMorphoAddress = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Mainnet:
      return '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
    case SupportedNetworks.Base:
      return '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
    case SupportedNetworks.Polygon:
      return '0x1bf0c2541f820e775182832f06c0b7fc27a25f67';
    default:
      return zeroAddress;
  }
};

export const getBundlerV2 = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Mainnet:
      return '0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077';
    case SupportedNetworks.Base:
      // ChainAgnosticBundlerV2
      return '0x23055618898e202386e6c13955a58D3C68200BFB';
    case SupportedNetworks.Polygon:
      // ChainAgnosticBundlerV2
      return '0x5738366B9348f22607294007e75114922dF2a16A';

    default:
      return zeroAddress;
  }
};

export const getIRMTitle = (address: string) => {
  switch (address.toLowerCase()) {
    case '0x870ac11d48b15db9a138cf899d20f13f79ba00bc':
      return 'Adaptive Curve';
    case '0x46415998764c29ab2a25cbea6254146d50d22687': // on base
      return 'Adaptive Curve';
    case '0xe675A2161D4a6E2de2eeD70ac98EEBf257FBF0B0': // on polygon
      return 'Adaptive Curve';
    default:
      return 'Unknown IRM';
  }
};

export const actionTypeToText = (type: UserTxTypes) => {
  switch (type) {
    case UserTxTypes.MarketBorrow:
      return 'Borrow';
    case UserTxTypes.MarketSupply:
      return 'Supply';
    case UserTxTypes.MarketWithdraw:
      return 'Withdraw';
    default:
      return type;
  }
};

const MAINNET_GENESIS_DATE = new Date('2023-12-28T09:09:23.000Z');
const BASE_GENESIS_DATE = new Date('2024-05-03T13:40:43.000Z');
const POLYGON_GENESIS_DATE = new Date('2025-01-20T02:03:12.000Z');

export function getMorphoGenesisDate(chainId: number): Date {
  switch (chainId) {
    case SupportedNetworks.Mainnet: // mainnet
      return MAINNET_GENESIS_DATE;
    case SupportedNetworks.Base: // base
      return BASE_GENESIS_DATE;
    case SupportedNetworks.Polygon:
      return POLYGON_GENESIS_DATE;
    default:
      return MAINNET_GENESIS_DATE; // default to mainnet
  }
}
