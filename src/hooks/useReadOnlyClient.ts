import { useMemo } from 'react';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { type SupportedNetworks, isSupportedChain } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export const useReadOnlyClient = (chainId: SupportedNetworks | number | undefined) => {
  const { customRpcUrls, rpcConfigVersion } = useCustomRpcContext();

  const client = useMemo(() => {
    if (chainId == null || !isSupportedChain(chainId)) {
      return null;
    }

    const supportedChainId = chainId as SupportedNetworks;
    return getClient(supportedChainId, customRpcUrls[supportedChainId]);
  }, [chainId, customRpcUrls, rpcConfigVersion]);

  return {
    client,
    customRpcUrls,
    rpcConfigVersion,
  };
};
