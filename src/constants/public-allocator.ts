import { SupportedNetworks } from '@/utils/networks';

// Keep this map keyed by SupportedNetworks so adding a network makes the
// required Public Allocator address explicit at the integration boundary.
export const PUBLIC_ALLOCATOR_ADDRESSES: Partial<Record<SupportedNetworks, `0x${string}`>> = {
  [SupportedNetworks.Mainnet]: '0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D',
  [SupportedNetworks.Optimism]: '0x0d68a97324E602E02799CD83B42D337207B40658',
  [SupportedNetworks.Base]: '0xA090dD1a701408Df1d4d0B85b716c87565f90467',
  [SupportedNetworks.Polygon]: '0xfac15aff53ADd2ff80C2962127C434E8615Df0d3',
  [SupportedNetworks.Unichain]: '0xB0c9a107fA17c779B3378210A7a593e88938C7C9',
  [SupportedNetworks.Arbitrum]: '0x769583Af5e9D03589F159EbEC31Cc2c23E8C355E',
  [SupportedNetworks.Etherlink]: '0x8b8B1bd41d36c06253203CD21463994aB752c1e6',
  [SupportedNetworks.HyperEVM]: '0x517505be22D9068687334e69ae7a02fC77edf4Fc',
  [SupportedNetworks.Monad]: '0xfd70575B732F9482F4197FE1075492e114E97302',
};
