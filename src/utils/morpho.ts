import { zeroAddress } from 'viem';
import { SupportedNetworks } from './networks';
import { UserTxTypes } from './types';
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
    case SupportedNetworks.Unichain:
      return '0x8f5ae9cddb9f68de460c77730b018ae7e04a140a';
    case SupportedNetworks.Arbitrum:
      return '0x6c247b1F6182318877311737BaC0844bAa518F5e';
    case SupportedNetworks.HyperEVM:
      return '0x68e37dE8d93d3496ae143F2E900490f6280C57cD';
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
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.Unichain:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.Arbitrum:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.HyperEVM:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
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
    case '0xe675a2161d4a6e2de2eed70ac98eebf257fbf0b0': // on polygon
      return 'Adaptive Curve';
    case '0x9a6061d51743b31d2c3be75d83781fa423f53f0e': // on unichain
      return 'Adaptive Curve';
    case '0x66f30587fb8d4206918deb78eca7d5ebbafd06da': // on arbitrum
      return 'Adaptive Curve';
    case '0xd4a426f010986dcad727e8dd6eed44ca4a9b7483': // on hyperevm
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

export function getMorphoGenesisDate(chainId: number): Date {
  switch (chainId) {
    case SupportedNetworks.Mainnet:
      return new Date('2023-12-28T09:09:23.000Z');
    case SupportedNetworks.Base:
      return new Date('2024-05-03T13:40:43.000Z');
    case SupportedNetworks.Polygon:
      return new Date('2025-01-20T02:03:12.000Z');;
    case SupportedNetworks.Unichain:
      return new Date('2025-02-18T02:03:6.000Z');
    case SupportedNetworks.Arbitrum:
      return new Date('2025-01-17T06:04:51.000Z');
    case SupportedNetworks.HyperEVM:
      return new Date('2025-04-03T04:52:00.000Z');
    default:
      return MAINNET_GENESIS_DATE; // default to mainnet
  }
}
