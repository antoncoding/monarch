import { type SupportedNetworks, getDefaultRPC } from '@/utils/networks';
import { useLocalStorage } from './useLocalStorage';

export type CustomRpcUrls = Partial<Record<SupportedNetworks, string>>;

export function useCustomRpc() {
  const [customRpcUrls, setCustomRpcUrls] = useLocalStorage<CustomRpcUrls>('customRpcUrls', {});

  const setRpcUrl = (chainId: SupportedNetworks, url: string | undefined) => {
    setCustomRpcUrls((prev) => {
      const newUrls = { ...prev };
      if (url === undefined || url === '' || url === getDefaultRPC(chainId)) {
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
