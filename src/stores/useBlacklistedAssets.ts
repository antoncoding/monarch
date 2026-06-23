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
};

type BlacklistedAssetsActions = {
  addBlacklistedAsset: (asset: Omit<BlacklistedAsset, 'addedAt'>) => boolean;
  removeBlacklistedAsset: (chainId: number, address: string) => void;
  isAssetBlacklisted: (chainId: number, address: string) => boolean;
};

type BlacklistedAssetsStore = BlacklistedAssetsState & BlacklistedAssetsActions;

export const useBlacklistedAssets = create<BlacklistedAssetsStore>()(
  persist(
    (set, get) => ({
      customBlacklistedAssets: [],

      addBlacklistedAsset: (asset) => {
        const key = getAssetBlacklistKey(asset.chainId, asset.address);
        const state = get();

        if (getBlacklistedAssetKeys(state.customBlacklistedAssets).has(key)) {
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
        }));

        return true;
      },

      removeBlacklistedAsset: (chainId, address) => {
        const key = getAssetBlacklistKey(chainId, address);

        set((state) => ({
          customBlacklistedAssets: state.customBlacklistedAssets.filter(
            (asset) => getAssetBlacklistKey(asset.chainId, asset.address) !== key,
          ),
        }));
      },

      isAssetBlacklisted: (chainId, address) =>
        getBlacklistedAssetKeys(get().customBlacklistedAssets).has(getAssetBlacklistKey(chainId, address)),
    }),
    {
      name: 'monarch_store_blacklistedAssets',
      partialize: (state) => ({
        customBlacklistedAssets: state.customBlacklistedAssets,
      }),
    },
  ),
);
