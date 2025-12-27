import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type SupportedNetworks, getDefaultRPC } from '@/utils/networks';

export type CustomRpcUrls = Partial<Record<SupportedNetworks, string>>;

type CustomRpcState = {
  customRpcUrls: CustomRpcUrls;
};

type CustomRpcActions = {
  setRpcUrl: (chainId: SupportedNetworks, url: string | undefined) => void;
  resetRpcUrl: (chainId: SupportedNetworks) => void;
  resetAllRpcUrls: () => void;
  isUsingCustomRpc: (chainId: SupportedNetworks) => boolean;
  hasAnyCustomRpcs: () => boolean;

  // Bulk update for migration
  setAll: (state: Partial<CustomRpcState>) => void;
};

type CustomRpcStore = CustomRpcState & CustomRpcActions;

/**
 * Zustand store for custom RPC URLs.
 *
 * @example
 * ```tsx
 * const { customRpcUrls, setRpcUrl, isUsingCustomRpc } = useCustomRpc();
 * ```
 */
export const useCustomRpc = create<CustomRpcStore>()(
  persist(
    (set, get) => ({
      // Default state
      customRpcUrls: {},

      // Actions
      setRpcUrl: (chainId, url) => {
        set((state) => {
          const newUrls = { ...state.customRpcUrls };
          if (url === undefined || url === '' || url === getDefaultRPC(chainId)) {
            delete newUrls[chainId];
          } else {
            newUrls[chainId] = url;
          }
          return { customRpcUrls: newUrls };
        });
      },

      resetRpcUrl: (chainId) => {
        get().setRpcUrl(chainId, undefined);
      },

      resetAllRpcUrls: () => set({ customRpcUrls: {} }),

      isUsingCustomRpc: (chainId) => Boolean(get().customRpcUrls[chainId]),

      hasAnyCustomRpcs: () => Object.keys(get().customRpcUrls).length > 0,

      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_customRpc',
    },
  ),
);
