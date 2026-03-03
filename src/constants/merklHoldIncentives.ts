import type { Address } from 'viem';
import { SupportedNetworks } from '@/utils/networks';

export type HardcodedMerklHoldIncentive = {
  chainId: number;
  collateralTokenAddress: Address;
  opportunityType: string;
  opportunityIdentifier: string;
  label: string;
};

const normalizeAddress = (address: string): string => address.toLowerCase();

export const HARDCODED_MERKL_HOLD_INCENTIVES: readonly HardcodedMerklHoldIncentive[] = [
  {
    chainId: SupportedNetworks.Base,
    collateralTokenAddress: '0x0000000f2eB9f69274678c76222B35eEc7588a65',
    opportunityType: 'ERC20LOGPROCESSOR',
    opportunityIdentifier: '0x0000000f2eB9f69274678c76222B35eEc7588a65',
    label: 'yoUSD',
  },
] as const;

export const getHardcodedMerklHoldIncentive = ({
  chainId,
  collateralTokenAddress,
}: {
  chainId: number;
  collateralTokenAddress: string;
}): HardcodedMerklHoldIncentive | null => {
  const normalizedCollateralAddress = normalizeAddress(collateralTokenAddress);

  const match = HARDCODED_MERKL_HOLD_INCENTIVES.find(
    (incentive) => incentive.chainId === chainId && normalizeAddress(incentive.collateralTokenAddress) === normalizedCollateralAddress,
  );

  return match ?? null;
};
