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

// Borrow & Repay
const BorrowModalGlobal = lazy(() => import('@/modals/borrow/borrow-modal-global').then((m) => ({ default: m.BorrowModalGlobal })));
const LeverageModalGlobal = lazy(() => import('@/modals/leverage/leverage-modal-global').then((m) => ({ default: m.LeverageModalGlobal })));

// Supply & Withdraw
const SupplyModalV2 = lazy(() => import('@/modals/supply/supply-modal').then((m) => ({ default: m.SupplyModalV2 })));

// Rebalance
const RebalanceModal = lazy(() =>
  import('@/features/positions/components/rebalance/rebalance-modal').then((m) => ({ default: m.RebalanceModal })),
);

const RebalanceMarketSelectionModal = lazy(() =>
  import('@/features/markets/components/market-selection-modal').then((m) => ({ default: m.MarketSelectionModal })),
);

const SmartRebalanceModal = lazy(() =>
  import('@/features/positions/components/rebalance/smart-rebalance-modal').then((m) => ({ default: m.SmartRebalanceModal })),
);

// Settings & Configuration
const MarketSettingsModal = lazy(() => import('@/features/markets/components/market-settings-modal'));

const MonarchSettingsModal = lazy(() =>
  import('@/modals/settings/monarch-settings/MonarchSettingsModal').then((m) => ({ default: m.MonarchSettingsModal })),
);

// Vault Operations
const VaultDepositModal = lazy(() => import('@/modals/vault/vault-deposit-modal'));
const VaultWithdrawModal = lazy(() => import('@/modals/vault/vault-withdraw-modal'));

/**
 * Central modal registry mapping modal types to their components.
 *
 * Type casting with 'any' is intentional - ModalRenderer provides
 * correct props at runtime based on modal type.
 */
export const MODAL_REGISTRY: {
  [K in ModalType]: ComponentType<any>;
} = {
  borrow: BorrowModalGlobal,
  leverage: LeverageModalGlobal,
  bridgeSwap: SwapModal,
  supply: SupplyModalV2,
  rebalance: RebalanceModal,
  rebalanceMarketSelection: RebalanceMarketSelectionModal,
  smartRebalance: SmartRebalanceModal,
  marketSettings: MarketSettingsModal,
  monarchSettings: MonarchSettingsModal,
  vaultDeposit: VaultDepositModal,
  vaultWithdraw: VaultWithdrawModal,
};
