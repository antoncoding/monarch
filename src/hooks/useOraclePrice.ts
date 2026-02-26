import type { Address } from 'abitype';
import { zeroAddress } from 'viem';
import { useReadContract } from 'wagmi';
import { abi } from '@/abis/chainlinkOraclev2';
import type { SupportedNetworks } from '@/utils/networks';

type Props = {
  oracle?: Address;
  chainId?: SupportedNetworks;
};

/**
 * @param oracle Address of the oracle contract
 */
export function useOraclePrice({ oracle, chainId = 1 }: Props) {
  const hasOracle = oracle != null;
  const { data } = useReadContract({
    abi: abi,
    functionName: 'price',
    address: oracle ?? zeroAddress,
    chainId,
    query: {
      enabled: hasOracle,
    },
  });

  return { price: typeof data === 'bigint' ? data : BigInt(0) };
}
