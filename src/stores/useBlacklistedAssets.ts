import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BlacklistedAsset = {
  address: string;
  chainId: number;
  symbol?: string;
  name?: string;
  addedAt: number;
};

export const getAssetBlacklistKey = (chainId: number, address: string): string => `${chainId}:${address.toLowerCase()}`;

export const getBlacklistedAssetKeys = (customBlacklistedAssets: readonly Pick<BlacklistedAsset, 'address' | 'chainId'>[]): Set<string> => {
  return new Set(customBlacklistedAssets.map((asset) => getAssetBlacklistKey(asset.chainId, asset.address)));
};

type BlacklistedAssetsState = {
  customBlacklistedAssets: BlacklistedAsset[];
  _cachedBlacklistedAssetKeys: Set<string> | null;
};

type BlacklistedAssetsActions = {
  addBlacklistedAsset: (asset: Omit<BlacklistedAsset, 'addedAt'>) => boolean;
  removeBlacklistedAsset: (chainId: number, address: string) => void;
  isAssetBlacklisted: (chainId: number, address: string) => boolean;
  getAllBlacklistedAssetKeys: () => Set<string>;
  setAll: (state: Partial<BlacklistedAssetsState>) => void;
};

type BlacklistedAssetsStore = BlacklistedAssetsState & BlacklistedAssetsActions;

export const useBlacklistedAssets = create<BlacklistedAssetsStore>()(
  persist(
    (set, get) => ({
      customBlacklistedAssets: [],
      _cachedBlacklistedAssetKeys: null,

      addBlacklistedAsset: (asset) => {
        const key = getAssetBlacklistKey(asset.chainId, asset.address);
        const state = get();

        if (state.getAllBlacklistedAssetKeys().has(key)) {
          return false;
        }

        set((prevState) => ({
          customBlacklistedAssets: [
            ...prevState.customBlacklistedAssets,
            {
              ...asset,
              address: asset.address.toLowerCase(),
              addedAt: Date.now(),
            },
          ],
          _cachedBlacklistedAssetKeys: null,
        }));

        return true;
      },

      removeBlacklistedAsset: (chainId, address) => {
        const key = getAssetBlacklistKey(chainId, address);

        set((state) => ({
          customBlacklistedAssets: state.customBlacklistedAssets.filter(
            (asset) => getAssetBlacklistKey(asset.chainId, asset.address) !== key,
          ),
          _cachedBlacklistedAssetKeys: null,
        }));
      },

      isAssetBlacklisted: (chainId, address) => get().getAllBlacklistedAssetKeys().has(getAssetBlacklistKey(chainId, address)),

      getAllBlacklistedAssetKeys: () => {
        const state = get();

        if (state._cachedBlacklistedAssetKeys) {
          return state._cachedBlacklistedAssetKeys;
        }

        const nextSet = getBlacklistedAssetKeys(state.customBlacklistedAssets);
        set({ _cachedBlacklistedAssetKeys: nextSet });
        return nextSet;
      },

      setAll: (newState) => set({ ...newState, _cachedBlacklistedAssetKeys: null }),
    }),
    {
      name: 'monarch_store_blacklistedAssets',
      partialize: (state) => ({
        customBlacklistedAssets: state.customBlacklistedAssets,
      }),
    },
  ),
);
