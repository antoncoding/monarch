import type { ComponentType } from 'react';
import type { ModalType } from '@/stores/useModalStore';

// Lazy load modal components for better code splitting
import { lazy } from 'react';

/**
 * Lazy-loaded modal components.
 * Only include modals that have been migrated to the Zustand system.
 */

// Swap & Bridge
const BridgeSwapModal = lazy(() => import('@/features/swap/components/BridgeSwapModal').then((m) => ({ default: m.BridgeSwapModal })));

// Supply & Withdraw
const SupplyModalV2 = lazy(() => import('@/modals/supply/supply-modal').then((m) => ({ default: m.SupplyModalV2 })));

const SupplyProcessModal = lazy(() => import('@/modals/supply/supply-process-modal').then((m) => ({ default: m.SupplyProcessModal })));

// Oracle & Information
const ChainlinkRiskTiersModal = lazy(() =>
  import('@/features/markets/components/oracle/MarketOracle/ChainlinkRiskTiersModal').then((m) => ({
    default: m.ChainlinkRiskTiersModal,
  })),
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
 * Only migrated modals should be registered here.
 *
 * Note: Components are lazy-loaded for optimal bundle splitting.
 *
 * Type casting with 'any' is intentional - the ModalRenderer will provide
 * the correct props at runtime based on the modal type.
 */
export const MODAL_REGISTRY: {
  [K in ModalType]: ComponentType<any>;
} = {
  // Swap & Bridge
  bridgeSwap: BridgeSwapModal,

  // Supply & Withdraw
  supply: SupplyModalV2,
  supplyProcess: SupplyProcessModal,

  // Oracle & Information
  chainlinkRiskTiers: ChainlinkRiskTiersModal,

  // Settings & Configuration
  blacklistedMarkets: BlacklistedMarketsModal,
  trustedVaults: TrustedVaultsModal,
  marketSettings: MarketSettingsModal,

  // Placeholders for modals not yet migrated
  // These will throw helpful errors if accidentally called
  vaultDeposit: (() => {
    throw new Error('vaultDeposit modal not yet migrated to Zustand');
  }) as any,
  vaultDepositProcess: (() => {
    throw new Error('vaultDepositProcess modal not yet migrated to Zustand');
  }) as any,
  borrow: (() => {
    throw new Error('borrow modal not yet migrated to Zustand');
  }) as any,
  borrowProcess: (() => {
    throw new Error('borrowProcess modal not yet migrated to Zustand');
  }) as any,
  repayProcess: (() => {
    throw new Error('repayProcess modal not yet migrated to Zustand');
  }) as any,
  rebalance: (() => {
    throw new Error('rebalance modal not yet migrated to Zustand');
  }) as any,
  rebalanceProcess: (() => {
    throw new Error('rebalanceProcess modal not yet migrated to Zustand');
  }) as any,
};
