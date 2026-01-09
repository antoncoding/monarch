import { create } from 'zustand';

export type TransactionType = 'supply' | 'borrow' | 'repay' | 'vaultDeposit' | 'wrap' | 'rebalance';

export type TransactionStep = {
  key: string;
  label: string;
  detail: string;
};

export type ActiveTransaction = {
  id: string;
  type: TransactionType;
  currentStep: string;
  steps: TransactionStep[];
  metadata: {
    tokenSymbol?: string;
    amount?: bigint;
    marketId?: string;
    vaultName?: string;
  };
  startedAt: number;
  isModalVisible: boolean;
};

type TransactionProcessState = {
  transactions: Record<string, ActiveTransaction>;
};

type TransactionProcessActions = {
  /**
   * Start tracking a new transaction.
   * Returns a unique transaction ID.
   */
  startTransaction: (tx: Omit<ActiveTransaction, 'id' | 'startedAt' | 'isModalVisible'>) => string;

  /**
   * Update the current step of a transaction.
   */
  updateStep: (txId: string, step: string) => void;

  /**
   * Mark a transaction as complete and remove from tracking.
   */
  completeTransaction: (txId: string) => void;

  /**
   * Mark a transaction as failed and remove from tracking.
   */
  failTransaction: (txId: string) => void;

  /**
   * Set whether the modal is visible for a transaction.
   */
  setModalVisible: (txId: string, visible: boolean) => void;

  /**
   * Get a specific transaction by ID.
   */
  getTransaction: (txId: string) => ActiveTransaction | undefined;

  /**
   * Get all active transactions.
   */
  getActiveTransactions: () => ActiveTransaction[];

  /**
   * Check if there are any active transactions.
   */
  hasActiveTransactions: () => boolean;

  /**
   * Get transactions with hidden modals (for indicator).
   */
  getBackgroundTransactions: () => ActiveTransaction[];
};

type TransactionProcessStore = TransactionProcessState & TransactionProcessActions;

/**
 * Global store for tracking active transactions.
 * Enables process modals to be closed while transactions continue in background.
 *
 * @example
 * ```tsx
 * const { startTransaction, updateStep, completeTransaction } = useTransactionProcessStore();
 *
 * // Start tracking a supply transaction
 * const txId = startTransaction({
 *   type: 'supply',
 *   currentStep: 'approve',
 *   steps: [...],
 *   metadata: { tokenSymbol: 'USDC' }
 * });
 *
 * // Update step as transaction progresses
 * updateStep(txId, 'signing');
 *
 * // Complete when done
 * completeTransaction(txId);
 * ```
 */
export const useTransactionProcessStore = create<TransactionProcessStore>((set, get) => ({
  transactions: {},

  startTransaction: (tx) => {
    const id = `${tx.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const transaction: ActiveTransaction = {
      ...tx,
      id,
      startedAt: Date.now(),
      isModalVisible: true,
    };

    set((state) => ({
      transactions: {
        ...state.transactions,
        [id]: transaction,
      },
    }));

    return id;
  },

  updateStep: (txId, step) => {
    set((state) => {
      const tx = state.transactions[txId];
      if (!tx) return state;

      return {
        transactions: {
          ...state.transactions,
          [txId]: {
            ...tx,
            currentStep: step,
          },
        },
      };
    });
  },

  completeTransaction: (txId) => {
    set((state) => {
      const { [txId]: _removed, ...remaining } = state.transactions;
      return { transactions: remaining };
    });
  },

  // failTransaction has same behavior as completeTransaction - both remove the transaction
  failTransaction: (txId) => {
    get().completeTransaction(txId);
  },

  setModalVisible: (txId, visible) => {
    set((state) => {
      const tx = state.transactions[txId];
      if (!tx) return state;

      return {
        transactions: {
          ...state.transactions,
          [txId]: {
            ...tx,
            isModalVisible: visible,
          },
        },
      };
    });
  },

  getTransaction: (txId) => {
    return get().transactions[txId];
  },

  getActiveTransactions: () => {
    return Object.values(get().transactions);
  },

  hasActiveTransactions: () => {
    return Object.keys(get().transactions).length > 0;
  },

  getBackgroundTransactions: () => {
    return Object.values(get().transactions).filter((tx) => !tx.isModalVisible);
  },
}));
