import { SupportedNetworks } from '@/utils/networks';
import { PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID } from './public-allocator-addresses';

// Keep this map keyed by SupportedNetworks so adding a network makes the
// required Public Allocator address explicit at the integration boundary.
export const PUBLIC_ALLOCATOR_ADDRESSES: Partial<Record<SupportedNetworks, `0x${string}`>> = {
  [SupportedNetworks.Mainnet]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Mainnet],
  [SupportedNetworks.Optimism]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Optimism],
  [SupportedNetworks.Base]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Base],
  [SupportedNetworks.Polygon]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Polygon],
  [SupportedNetworks.Unichain]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Unichain],
  [SupportedNetworks.Arbitrum]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Arbitrum],
  [SupportedNetworks.HyperEVM]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.HyperEVM],
  [SupportedNetworks.Monad]: PUBLIC_ALLOCATOR_ADDRESSES_BY_CHAIN_ID[SupportedNetworks.Monad],
};
