import { SupportedNetworks } from '@/utils/networks';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_RPC_URLS } from '@/utils/rpc';

export type CustomRpcUrls = {
  [SupportedNetworks.Mainnet]?: string;
  [SupportedNetworks.Base]?: string;
  [SupportedNetworks.Polygon]?: string;
  [SupportedNetworks.Unichain]?: string;
};

export function useCustomRpc() {
  const [customRpcUrls, setCustomRpcUrls] = useLocalStorage<CustomRpcUrls>('customRpcUrls', {});

  
  const setRpcUrl = (chainId: SupportedNetworks, url: string | undefined) => {
    setCustomRpcUrls((prev) => {
      const newUrls = { ...prev };
      if (url === undefined || url === '' || url === DEFAULT_RPC_URLS[chainId]) {
        delete newUrls[chainId];
      } else {
        newUrls[chainId] = url;
      }
      return newUrls;
    });
  };

  const resetRpcUrl = (chainId: SupportedNetworks) => {
    setRpcUrl(chainId, undefined);
  };

  const resetAllRpcUrls = () => {
    setCustomRpcUrls({});
  };

  const isUsingCustomRpc = (chainId: SupportedNetworks): boolean => {
    return Boolean(customRpcUrls[chainId]);
  };

  const hasAnyCustomRpcs = (): boolean => {
    return Object.keys(customRpcUrls).length > 0;
  };

  return {
    customRpcUrls,
    setRpcUrl,
    resetRpcUrl,
    resetAllRpcUrls,
    isUsingCustomRpc,
    hasAnyCustomRpcs,
  };
}
