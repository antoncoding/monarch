import type { Address } from 'viem';
import { create } from 'zustand';
import type { Market, MarketPosition, GroupedPosition } from '@/utils/types';
import type { SwapToken } from '@/features/swap/types';
import type { SupportedNetworks } from '@/utils/networks';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';

/**
 * Registry of Zustand-managed modals (Pattern 2).
 * Only includes modals with multi-trigger or modal chaining requirements.
 * See docs/Styling.md for Pattern 1 (local state) vs Pattern 2 (Zustand) decision framework.
 */
export type ModalProps = {
  // Swap & Bridge
  bridgeSwap: {
    defaultTargetToken?: SwapToken;
  };

  // Borrow & Repay
  borrow: {
    market: Market;
    defaultMode?: 'borrow' | 'repay';
    toggleBorrowRepay?: boolean;
    refetch?: () => void;
    liquiditySourcing?: LiquiditySourcingResult;
  };

  // Leverage & Deleverage
  leverage: {
    market: Market;
    defaultMode?: 'leverage' | 'deleverage';
    toggleLeverageDeleverage?: boolean;
    refetch?: () => void;
  };

  // Supply & Withdraw
  supply: {
    market: Market;
    position?: MarketPosition | null;
    defaultMode?: 'supply' | 'withdraw';
    isMarketPage?: boolean;
    refetch?: () => void;
    liquiditySourcing?: LiquiditySourcingResult;
  };

  // Rebalance
  rebalance: {
    groupedPosition: GroupedPosition;
    refetch: (onSuccess?: () => void) => void;
    isRefetching: boolean;
  };

  rebalanceMarketSelection: {
    vaultAsset: `0x${string}`;
    chainId: SupportedNetworks;
    multiSelect?: boolean;
    onSelect: (markets: Market[]) => void;
  };

  smartRebalance: {
    groupedPosition: GroupedPosition;
    quickMode?: boolean;
  };

  // Settings & Configuration
  marketSettings: {
    zIndex?: 'settings' | 'top'; // Override z-index when opened from nested modals
  };

  monarchSettings: {
    initialCategory?: 'transaction' | 'display' | 'filters' | 'preferences' | 'experimental';
    initialDetailView?: 'custom-tag-config' | 'trusted-vaults' | 'blacklisted-markets' | 'rpc-config' | 'filter-thresholds';
    onCloseCallback?: () => void;
  };

  // Vault Operations
  vaultDeposit: {
    vaultAddress: Address;
    vaultName: string;
    assetAddress: Address;
    assetSymbol: string;
    assetDecimals: number;
    chainId: SupportedNetworks;
    onSuccess?: () => void;
  };

  vaultWithdraw: {
    vaultAddress: Address;
    vaultName: string;
    assetAddress: Address;
    assetSymbol: string;
    assetDecimals: number;
    chainId: SupportedNetworks;
    onSuccess?: () => void;
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
   * Update props for an existing modal by type.
   * Useful for modals that need dynamic prop updates while open.
   */
  update: <T extends ModalType>(type: T, props: Partial<ModalProps[T]>) => void;

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

  update: (type, props) => {
    set((state) => ({
      stack: state.stack.map((modal) => {
        if (modal.type === type) {
          return { ...modal, props: { ...modal.props, ...props } };
        }
        return modal;
      }),
    }));
  },

  getModalProps: (type) => {
    const modal = get().stack.find((m) => m.type === type);
    return modal?.props as ModalProps[typeof type] | undefined;
  },

  isOpen: (type) => {
    return get().stack.some((modal) => modal.type === type);
  },
}));
