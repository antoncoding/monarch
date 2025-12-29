import { useCallback, useMemo, useState } from 'react';
import { ArrowDownIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { formatUnits, parseUnits } from 'viem';
import { useConnection } from 'wagmi';
import { motion } from 'framer-motion';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { useUserBalancesQuery } from '@/hooks/queries/useUserBalancesQuery';
import { useAllowance } from '@/hooks/useAllowance';
import { formatBalance } from '@/utils/balance';
import { useCowBridge } from '../hooks/useCowBridge';
import { TokenNetworkDropdown } from './TokenNetworkDropdown';
import { COW_BRIDGE_CHAINS, COW_VAULT_RELAYER, type SwapToken } from '../types';
import { DEFAULT_SLIPPAGE_PERCENT } from '../constants';

type BridgeSwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetToken: SwapToken;
};

export function BridgeSwapModal({ isOpen, onClose, targetToken }: BridgeSwapModalProps) {
  const { address: account } = useConnection();
  const [sourceToken, setSourceToken] = useState<SwapToken | null>(null);
  const [inputAmount, setInputAmount] = useState<string>('0');
  const [amount, setAmount] = useState<bigint>(BigInt(0));
  const [slippage, _setSlippage] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);

  // Fetch user balances from CoW-supported chains
  const { data: balances = [], isLoading: balancesLoading } = useUserBalancesQuery({
    networkIds: COW_BRIDGE_CHAINS as unknown as number[],
  });

  // Handle approval for source token
  const { allowance, approveInfinite, approvePending } = useAllowance({
    token: (sourceToken?.address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chainId: sourceToken?.chainId,
    user: account,
    spender: COW_VAULT_RELAYER,
    tokenSymbol: sourceToken?.symbol,
  });

  // Convert balances to SwapTokens (support cross-chain)
  const availableTokens = useMemo<SwapToken[]>(() => {
    return balances
      .filter((b) => BigInt(b.balance) > BigInt(0)) // Only show tokens with balance
      .filter(
        // Not the same token as target
        (b) => !(b.chainId === targetToken.chainId && b.address.toLowerCase() === targetToken.address.toLowerCase()),
      )
      .map((b) => ({
        address: b.address,
        symbol: b.symbol,
        chainId: b.chainId,
        decimals: b.decimals,
        balance: BigInt(b.balance),
      }))
      .sort((a, b) => {
        // Sort by balance (descending)
        const aValue = Number(formatUnits(a.balance ?? BigInt(0), a.decimals));
        const bValue = Number(formatUnits(b.balance ?? BigInt(0), b.decimals));
        return bValue - aValue;
      });
  }, [balances, targetToken.chainId, targetToken.address]);

  // CoW Bridge hook
  const { quote, isQuoting, isExecuting, error, orderUid, executeSwap, reset } = useCowBridge({
    sourceToken,
    targetToken,
    amount,
    slippageBps: Math.round(slippage * 100),
  });

  // Check if approval is needed
  const needsApproval = allowance < amount && amount > BigInt(0);

  const handleSourceTokenSelect = (token: SwapToken) => {
    setSourceToken(token);
    setAmount(BigInt(0));
    setInputAmount('0');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputAmount(value);

    if (!sourceToken) return;

    try {
      const parsed = parseUnits(value, sourceToken.decimals);
      setAmount(parsed);
    } catch {
      // Invalid input, keep previous amount
    }
  };

  const handleMaxClick = () => {
    if (sourceToken?.balance) {
      setAmount(sourceToken.balance);
      setInputAmount(formatBalance(sourceToken.balance, sourceToken.decimals).toString());
    }
  };

  const handleClose = () => {
    reset();
    setSourceToken(null);
    setAmount(BigInt(0));
    setInputAmount('0');
    onClose();
  };

  // Unified execution handler - handles approve + swap automatically
  const handleSwap = useCallback(async () => {
    if (needsApproval) {
      await approveInfinite();
    }
    await executeSwap();
  }, [needsApproval, approveInfinite, executeSwap]);

  const isLoading = isQuoting || approvePending || isExecuting;

  // Format error messages to be user-friendly
  const formatErrorMessage = (errorMsg: string): string => {
    if (errorMsg.includes('BUILD_TX_ERROR')) return 'Failed to build transaction. Please try again.';
    if (errorMsg.includes('same from and to token')) return 'Cannot swap to the same token. Try selecting a different source token.';
    if (errorMsg.toLowerCase().includes('insufficient')) return errorMsg;
    return errorMsg;
  };

  // Determine output display text
  const getOutputDisplay = () => {
    if (!sourceToken) return 'Select token above';
    if (amount === BigInt(0)) return '0';
    if (isQuoting) return 'Loading...';
    if (error) return <span className="text-xs text-orange-600 dark:text-orange-400">{formatErrorMessage(error)}</span>;
    if (quote) return <span className="text-lg">{Number(formatUnits(quote.buyAmount, targetToken.decimals)).toFixed(6)}</span>;
    return '0';
  };

  // Truncate order hash for display (e.g., "0x1234...5678")
  const _truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="lg"
    >
      <ModalHeader
        title="Swap Tokens"
        description={`Swap to ${targetToken.symbol} via CoW Protocol`}
      />

      <ModalBody>
        <div className="space-y-4">
          {/* From Section - Always visible */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-secondary">From</span>
              {sourceToken && (
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-xs text-secondary hover:text-primary"
                >
                  Balance: {sourceToken.balance ? formatBalance(sourceToken.balance, sourceToken.decimals) : '0'} {sourceToken.symbol}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputAmount}
                onChange={handleInputChange}
                placeholder="0"
                disabled={!sourceToken}
                className="bg-hovered h-10 flex-1 rounded-sm px-3 text-lg focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <TokenNetworkDropdown
                selectedToken={sourceToken}
                tokens={availableTokens}
                onSelect={handleSourceTokenSelect}
                placeholder="Select"
                disabled={availableTokens.length === 0}
              />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDownIcon className="text-secondary h-5 w-5" />
          </div>

          {/* To Section - Always visible */}
          <div>
            <div className="mb-1.5 text-xs text-secondary">To</div>
            <div className="flex items-center gap-2">
              <div className="bg-hovered flex h-10 flex-1 items-center rounded-sm px-3 text-xs text-secondary">{getOutputDisplay()}</div>
              <TokenNetworkDropdown
                selectedToken={targetToken}
                tokens={[targetToken]}
                onSelect={() => {}}
                disabled
              />
            </div>
            <div className="mt-1.5 text-xs text-secondary">
              {quote && sourceToken && !error && (
                <span>
                  1 {sourceToken.symbol} ≈{' '}
                  {(
                    Number(formatUnits(quote.buyAmount, targetToken.decimals)) / Number(formatUnits(quote.sellAmount, sourceToken.decimals))
                  ).toFixed(6)}{' '}
                  {targetToken.symbol}
                </span>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded bg-orange-50 p-3 text-sm dark:bg-orange-900/20"
            >
              <span className="text-orange-700 dark:text-orange-300 text-xs">{formatErrorMessage(error)}</span>
            </motion.div>
          )}

          {/* Quote Details */}
          {quote && sourceToken && !error && quote.type === 'cross-chain' && (
            <div className="bg-surface space-y-2 rounded p-3 text-sm">
              {quote.bridgeProvider && (
                <div className="flex justify-between">
                  <span className="text-secondary">Bridge</span>
                  <span className="font-medium">{quote.bridgeProvider}</span>
                </div>
              )}
              {quote.estimatedTimeSeconds && (
                <div className="flex justify-between">
                  <span className="text-secondary">Estimated time</span>
                  <span className="font-medium">~{Math.ceil(quote.estimatedTimeSeconds / 60)} min</span>
                </div>
              )}
              {quote.bridgeFee && (
                <div className="flex justify-between">
                  <span className="text-secondary">Bridge fee</span>
                  <span className="font-medium">
                    {Number(formatUnits(quote.bridgeFee, sourceToken.decimals)).toFixed(6)} {sourceToken.symbol}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {orderUid && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded bg-green-50 p-3 text-sm dark:bg-green-900/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary text-xs">Order Created 🎉</span>
                <a
                  href={`https://explorer.cow.fi/orders/${orderUid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-xs underline hover:opacity-80"
                >
                  View in CoW Explorer
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {!balancesLoading && availableTokens.length === 0 && !sourceToken && (
            <div className="text-secondary py-6 text-center text-sm">
              <p>No tokens found on supported chains</p>
              <p className="mt-1 text-xs opacity-70">Supported: Ethereum, Base, Polygon, Arbitrum</p>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          variant="default"
          onClick={handleClose}
        >
          {orderUid ? 'Close' : 'Cancel'}
        </Button>
        {!orderUid && (
          <ExecuteTransactionButton
            targetChainId={sourceToken?.chainId ?? 1}
            onClick={() => void handleSwap()}
            isLoading={isLoading}
            disabled={!quote || amount === BigInt(0) || !!error}
            variant="primary"
          >
            {needsApproval ? 'Approve & Swap' : 'Swap'}
          </ExecuteTransactionButton>
        )}
      </ModalFooter>
    </Modal>
  );
}
