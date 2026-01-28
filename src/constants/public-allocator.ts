import { SupportedNetworks } from '@/utils/networks';

export const PUBLIC_ALLOCATOR_ADDRESSES: Partial<Record<SupportedNetworks, `0x${string}`>> = {
  [SupportedNetworks.Mainnet]: '0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D',
  [SupportedNetworks.Base]: '0xA090dD1a701408Df1d4d0B85b716c87565f90467',
};
