import type { ComponentType } from 'react';
import type { ModalType, ModalProps } from '@/stores/useModalStore';

// Lazy load modal components for better code splitting
import { lazy } from 'react';

// Swap & Bridge
const BridgeSwapModal = lazy(() =>
  import('@/features/swap/components/BridgeSwapModal').then((m) => ({ default: m.BridgeSwapModal })),
);

// Supply & Withdraw
const SupplyModalV2 = lazy(() => import('@/modals/supply/supply-modal').then((m) => ({ default: m.SupplyModalV2 })));

const SupplyProcessModal = lazy(() =>
  import('@/modals/supply/supply-process-modal').then((m) => ({ default: m.SupplyProcessModal })),
);

// Vault
const DepositToVaultModal = lazy(() =>
  import('@/features/autovault/components/vault-detail/modals/deposit-to-vault-modal').then((m) => ({
    default: m.DepositToVaultModal,
  })),
);

const VaultDepositProcessModal = lazy(() =>
  import('@/features/autovault/components/vault-detail/modals/vault-deposit-process-modal').then((m) => ({
    default: m.VaultDepositProcessModal,
  })),
);

// Settings & Configuration
const MarketSettingsModal = lazy(() =>
  import('@/features/markets/components/market-settings-modal').then((m) => ({ default: m.default })),
);

const TrustedVaultsModal = lazy(() =>
  import('@/modals/settings/trusted-vaults-modal').then((m) => ({ default: m.default })),
);

const BlacklistedMarketsModal = lazy(() =>
  import('@/modals/settings/blacklisted-markets-modal').then((m) => ({ default: m.default })),
);

// Oracle & Information
const ChainlinkRiskTiersModal = lazy(() =>
  import('@/features/markets/components/oracle/MarketOracle/ChainlinkRiskTiersModal').then((m) => ({
    default: m.ChainlinkRiskTiersModal,
  })),
);

// Borrow
const BorrowModal = lazy(() => import('@/modals/borrow/borrow-modal').then((m) => ({ default: m.BorrowModal })));

const BorrowProcessModal = lazy(() =>
  import('@/modals/borrow/borrow-process-modal').then((m) => ({ default: m.BorrowProcessModal })),
);

const RepayProcessModal = lazy(() =>
  import('@/modals/borrow/repay-process-modal').then((m) => ({ default: m.RepayProcessModal })),
);

// Rebalance
const RebalanceModal = lazy(() =>
  import('@/features/positions/components/rebalance/rebalance-modal').then((m) => ({ default: m.RebalanceModal })),
);

const RebalanceProcessModal = lazy(() =>
  import('@/features/positions/components/rebalance/rebalance-process-modal').then((m) => ({
    default: m.RebalanceProcessModal,
  })),
);

/**
 * Central modal registry mapping modal types to their components.
 * All modals should be registered here to work with the modal store.
 *
 * Note: Components are lazy-loaded for optimal bundle splitting.
 */
export const MODAL_REGISTRY: {
  [K in ModalType]: ComponentType<ModalProps[K] & { onClose: () => void; isOpen: boolean }>;
} = {
  // Swap & Bridge
  bridgeSwap: BridgeSwapModal as ComponentType<ModalProps['bridgeSwap'] & { onClose: () => void; isOpen: boolean }>,

  // Supply & Withdraw
  supply: SupplyModalV2 as ComponentType<ModalProps['supply'] & { onClose: () => void; isOpen: boolean }>,
  supplyProcess: SupplyProcessModal as ComponentType<ModalProps['supplyProcess'] & { onClose: () => void; isOpen: boolean }>,

  // Vault
  vaultDeposit: DepositToVaultModal as ComponentType<ModalProps['vaultDeposit'] & { onClose: () => void; isOpen: boolean }>,
  vaultDepositProcess: VaultDepositProcessModal as ComponentType<
    ModalProps['vaultDepositProcess'] & { onClose: () => void; isOpen: boolean }
  >,

  // Settings & Configuration
  marketSettings: MarketSettingsModal as ComponentType<ModalProps['marketSettings'] & { onClose: () => void; isOpen: boolean }>,
  trustedVaults: TrustedVaultsModal as ComponentType<ModalProps['trustedVaults'] & { onClose: () => void; isOpen: boolean }>,
  blacklistedMarkets: BlacklistedMarketsModal as ComponentType<
    ModalProps['blacklistedMarkets'] & { onClose: () => void; isOpen: boolean }
  >,

  // Oracle & Information
  chainlinkRiskTiers: ChainlinkRiskTiersModal as ComponentType<
    ModalProps['chainlinkRiskTiers'] & { onClose: () => void; isOpen: boolean }
  >,

  // Borrow
  borrow: BorrowModal as ComponentType<ModalProps['borrow'] & { onClose: () => void; isOpen: boolean }>,
  borrowProcess: BorrowProcessModal as ComponentType<ModalProps['borrowProcess'] & { onClose: () => void; isOpen: boolean }>,
  repayProcess: RepayProcessModal as ComponentType<ModalProps['repayProcess'] & { onClose: () => void; isOpen: boolean }>,

  // Rebalance
  rebalance: RebalanceModal as ComponentType<ModalProps['rebalance'] & { onClose: () => void; isOpen: boolean }>,
  rebalanceProcess: RebalanceProcessModal as ComponentType<ModalProps['rebalanceProcess'] & { onClose: () => void; isOpen: boolean }>,
};
