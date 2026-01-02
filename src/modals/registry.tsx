import type { ComponentType } from 'react';
import type { ModalType } from '@/stores/useModalStore';
import { lazy } from 'react';

/**
 * Registry of Zustand-managed modals (Pattern 2).
 * Only includes modals with multi-trigger or modal chaining requirements.
 * See docs/Styling.md for complete modal inventory.
 *
 * Components are lazy-loaded for optimal code splitting.
 */

// Swap
const SwapModal = lazy(() => import('@/features/swap/components/SwapModal').then((m) => ({ default: m.SwapModal })));

// Supply & Withdraw
const SupplyModalV2 = lazy(() => import('@/modals/supply/supply-modal').then((m) => ({ default: m.SupplyModalV2 })));

// Rebalance
const RebalanceModal = lazy(() =>
  import('@/features/positions/components/rebalance/rebalance-modal').then((m) => ({ default: m.RebalanceModal })),
);

const RebalanceProcessModal = lazy(() =>
  import('@/features/positions/components/rebalance/rebalance-process-modal').then((m) => ({ default: m.RebalanceProcessModal })),
);

const RebalanceMarketSelectionModal = lazy(() =>
  import('@/features/markets/components/market-selection-modal').then((m) => ({ default: m.MarketSelectionModal })),
);

// Settings & Configuration
const BlacklistedMarketsModal = lazy(() =>
  import('@/modals/settings/blacklisted-markets-modal').then((m) => ({
    default: m.BlacklistedMarketsModal,
  })),
);

const TrustedVaultsModal = lazy(() => import('@/modals/settings/trusted-vaults-modal'));

const MarketSettingsModal = lazy(() => import('@/features/markets/components/market-settings-modal'));

/**
 * Central modal registry mapping modal types to their components.
 *
 * Type casting with 'any' is intentional - ModalRenderer provides
 * correct props at runtime based on modal type.
 */
export const MODAL_REGISTRY: {
  [K in ModalType]: ComponentType<any>;
} = {
  bridgeSwap: SwapModal,
  supply: SupplyModalV2,
  rebalance: RebalanceModal,
  rebalanceProcess: RebalanceProcessModal,
  rebalanceMarketSelection: RebalanceMarketSelectionModal,
  marketSettings: MarketSettingsModal,
  trustedVaults: TrustedVaultsModal,
  blacklistedMarkets: BlacklistedMarketsModal,
};
