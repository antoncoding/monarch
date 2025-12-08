import type { Address } from 'abitype';
import { useReadContract } from 'wagmi';
import { abi } from '@/abis/chainlinkOraclev2';
import type { SupportedNetworks } from '@/utils/networks';

type Props = {
  oracle: Address;
  chainId?: SupportedNetworks;
};

/**
 * @param oracle Address of the oracle contract
 */
export function useOraclePrice({ oracle, chainId = 1 }: Props) {
  const { data } = useReadContract({
    abi: abi,
    functionName: 'price',
    address: oracle,
    chainId,
  });

  return { price: data ? BigInt(data as string) : BigInt(0) };
}
