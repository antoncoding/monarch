import { create } from 'zustand';
import type { Market, MarketPosition } from '@/utils/types';
import type { SwapToken } from '@/features/swap/types';
import type { Address } from 'viem';
import type { TrustedVault } from '@/constants/vaults/known_vaults';

/**
 * Central registry of all modal types and their required props.
 * Add new modals here to get full type safety across the app.
 */
export type ModalProps = {
  // Swap & Bridge
  bridgeSwap: {
    targetToken: SwapToken;
  };

  // Supply & Withdraw
  supply: {
    market: Market;
    position?: MarketPosition | null;
    defaultMode?: 'supply' | 'withdraw';
    isMarketPage?: boolean;
    refetch?: () => void;
  };

  supplyProcess: {
    supplies: Array<{ market: Market; amount: bigint }>;
    currentStep: 'approve' | 'signing' | 'supplying';
    tokenSymbol: string;
    useEth: boolean;
    usePermit2?: boolean;
  };

  // Vault
  vaultDeposit: {
    vaultAddress: Address;
    vaultName: string;
    assetAddress: Address;
    assetSymbol: string;
    assetDecimals: number;
    chainId: number;
    onSuccess?: () => void;
  };

  vaultDepositProcess: {
    currentStep: 'approve' | 'signing' | 'depositing';
    vaultName: string;
    assetSymbol: string;
    amount: bigint;
    assetDecimals: number;
    usePermit2: boolean;
  };

  // Settings & Configuration
  marketSettings: {
    usdFilters: {
      minSupply: string;
      minBorrow: string;
      minLiquidity: string;
    };
    setUsdFilters: (filters: { minSupply: string; minBorrow: string; minLiquidity: string }) => void;
    entriesPerPage: number;
    onEntriesPerPageChange: (value: number) => void;
    columnVisibility: Record<string, boolean>;
    setColumnVisibility: (visibility: Record<string, boolean>) => void;
    onOpenTrustedVaultsModal?: () => void;
    trustedVaults?: TrustedVault[];
  };

  trustedVaults: {
    trustedVaults: TrustedVault[];
    onSave: (vaults: TrustedVault[]) => void;
  };

  blacklistedMarkets: {
    blacklistedMarkets: Array<{ uniqueKey: string; chainId: number; reason?: string }>;
    onRemove: (uniqueKey: string) => void;
  };

  // Oracle & Information
  chainlinkRiskTiers: Record<string, never>; // No props needed

  // Borrow
  borrow: {
    market: Market;
    position?: MarketPosition | null;
    onOpenChange: (open: boolean) => void;
    refetch?: () => void;
    isMarketPage?: boolean;
    defaultMode?: 'borrow' | 'repay';
  };

  borrowProcess: {
    borrows: Array<{ market: Market; amount: bigint }>;
    currentStep: 'approve' | 'signing' | 'borrowing';
    tokenSymbol: string;
    usePermit2?: boolean;
  };

  repayProcess: {
    repays: Array<{ market: Market; amount: bigint }>;
    currentStep: 'approve' | 'signing' | 'repaying';
    tokenSymbol: string;
    useEth: boolean;
    usePermit2?: boolean;
  };

  // Rebalance
  rebalance: {
    fromMarket: Market;
    fromPosition: MarketPosition;
    onClose: () => void;
    refetch: () => void;
  };

  rebalanceProcess: {
    operations: Array<{
      type: 'withdraw' | 'supply';
      market: Market;
      amount: bigint;
    }>;
    currentStep: 'approve' | 'signing' | 'executing';
  };
};

export type ModalType = keyof ModalProps;

type ModalState = {
  // Active modals stack (supports multiple modals open at once)
  stack: Array<{
    type: ModalType;
    props: ModalProps[ModalType];
    id: string; // Unique ID for each modal instance
  }>;
};

type ModalActions = {
  /**
   * Open a modal with type-safe props.
   * Multiple modals can be stacked.
   */
  open: <T extends ModalType>(type: T, props: ModalProps[T]) => string;

  /**
   * Close a specific modal by ID or type.
   * If no ID provided, closes the topmost modal of that type.
   */
  close: (typeOrId: ModalType | string) => void;

  /**
   * Close all modals.
   */
  closeAll: () => void;

  /**
   * Get props for a specific modal type (useful for modal components).
   */
  getModalProps: <T extends ModalType>(type: T) => ModalProps[T] | undefined;

  /**
   * Check if a modal type is currently open.
   */
  isOpen: (type: ModalType) => boolean;
};

type ModalStore = ModalState & ModalActions;

/**
 * Global modal store using Zustand.
 * Provides type-safe modal management with support for modal stacking.
 *
 * @example
 * ```tsx
 * // Opening a modal from anywhere:
 * const { open } = useModalStore();
 * open('bridgeSwap', { targetToken: myToken });
 *
 * // In modal component:
 * const { close, getModalProps } = useModalStore();
 * const props = getModalProps('bridgeSwap');
 * ```
 */
export const useModalStore = create<ModalStore>((set, get) => ({
  stack: [],

  open: (type, props) => {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    set((state) => ({
      stack: [...state.stack, { type, props, id }],
    }));
    return id;
  },

  close: (typeOrId) => {
    set((state) => {
      // If it's an ID, remove that specific modal
      if (typeOrId.includes('-')) {
        return {
          stack: state.stack.filter((modal) => modal.id !== typeOrId),
        };
      }

      // Otherwise, remove the topmost modal of that type
      const index = [...state.stack].reverse().findIndex((modal) => modal.type === typeOrId);
      if (index === -1) return state;

      const actualIndex = state.stack.length - 1 - index;
      return {
        stack: state.stack.filter((_, i) => i !== actualIndex),
      };
    });
  },

  closeAll: () => {
    set({ stack: [] });
  },

  getModalProps: (type) => {
    const modal = get().stack.find((m) => m.type === type);
    return modal?.props as ModalProps[typeof type] | undefined;
  },

  isOpen: (type) => {
    return get().stack.some((modal) => modal.type === type);
  },
}));
