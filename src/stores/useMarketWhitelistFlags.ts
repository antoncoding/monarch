import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMarketIdentityKey } from '@/utils/market-identity';
import type { MorphoWhitelistStatusRefresh } from '@/data-sources/morpho-api/market-whitelist-status';

type MarketWhitelistFlagsState = {
  flagsByNetwork: Record<string, Record<string, boolean>>;
  lastSyncedAtByNetwork: Record<string, number>;
};

type MarketWhitelistFlagsActions = {
  replaceNetworks: (refreshes: MorphoWhitelistStatusRefresh[]) => void;
};

type MarketWhitelistFlagsStore = MarketWhitelistFlagsState & MarketWhitelistFlagsActions;

export const useMarketWhitelistFlags = create<MarketWhitelistFlagsStore>()(
  persist(
    (set) => ({
      flagsByNetwork: {},
      lastSyncedAtByNetwork: {},

      replaceNetworks: (refreshes) => {
        if (refreshes.length === 0) {
          return;
        }

        set((state) => {
          const nextFlagsByNetwork = { ...state.flagsByNetwork };
          const nextLastSyncedAtByNetwork = { ...state.lastSyncedAtByNetwork };
          const syncTime = Date.now();

          refreshes.forEach(({ network, statuses }) => {
            nextFlagsByNetwork[String(network)] = statuses.reduce<Record<string, boolean>>((acc, status) => {
              acc[getMarketIdentityKey(status.chainId, status.uniqueKey)] = status.listed;
              return acc;
            }, {});
            nextLastSyncedAtByNetwork[String(network)] = syncTime;
          });

          return {
            flagsByNetwork: nextFlagsByNetwork,
            lastSyncedAtByNetwork: nextLastSyncedAtByNetwork,
          };
        });
      },
    }),
    {
      name: 'monarch_store_marketWhitelistFlags',
      partialize: (state) => ({
        flagsByNetwork: state.flagsByNetwork,
        lastSyncedAtByNetwork: state.lastSyncedAtByNetwork,
      }),
    },
  ),
);
