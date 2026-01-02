import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowDownIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { formatUnits, parseUnits } from 'viem';
import { useConnection } from 'wagmi';
import { motion } from 'framer-motion';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { useUserBalancesQuery } from '@/hooks/queries/useUserBalancesQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useAllowance } from '@/hooks/useAllowance';
import { formatBalance } from '@/utils/balance';
import { getNetworkName } from '@/utils/networks';
import { useCowSwap } from '../hooks/useCowSwap';
import { TokenNetworkDropdown } from './TokenNetworkDropdown';
import { COW_SWAP_CHAINS, COW_VAULT_RELAYER, type SwapToken } from '../types';
import { DEFAULT_SLIPPAGE_PERCENT } from '../constants';

type SwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetToken?: SwapToken;
};

export function SwapModal({ isOpen, onClose, defaultTargetToken }: SwapModalProps) {
  const { address: account } = useConnection();
  const [sourceToken, setSourceToken] = useState<SwapToken | null>(null);
  const [targetToken, setTargetToken] = useState<SwapToken | null>(defaultTargetToken ?? null);
  const [inputAmount, setInputAmount] = useState<string>('0');
  const [amount, setAmount] = useState<bigint>(BigInt(0));
  const [slippage, _setSlippage] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);

  // Fetch user balances from CoW-supported chains
  const { data: balances = [], isLoading: balancesLoading } = useUserBalancesQuery({
    networkIds: COW_SWAP_CHAINS as unknown as number[],
  });

  // Fetch all tokens for target selection
  const { allTokens } = useTokensQuery();

  // Fetch markets to filter target tokens
  const { data: markets } = useMarketsQuery();

  // Handle approval for source token
  const { allowance, approveInfinite, approvePending } = useAllowance({
    token: (sourceToken?.address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chainId: sourceToken?.chainId,
    user: account,
    spender: COW_VAULT_RELAYER,
    tokenSymbol: sourceToken?.symbol,
  });

  // Convert balances to SwapTokens (for source selection)
  const sourceTokens = useMemo<SwapToken[]>(() => {
    return balances
      .filter((b) => BigInt(b.balance) > BigInt(0))
      .map((b) => ({
        address: b.address,
        symbol: b.symbol,
        chainId: b.chainId,
        decimals: b.decimals,
        balance: BigInt(b.balance),
      }))
      .sort((a, b) => {
        const aValue = Number(formatUnits(a.balance ?? BigInt(0), a.decimals));
        const bValue = Number(formatUnits(b.balance ?? BigInt(0), b.decimals));
        return bValue - aValue;
      });
  }, [balances]);

  // Target tokens: all tokens with Morpho markets on CoW-supported chains
  const targetTokens = useMemo<SwapToken[]>(() => {
    if (!markets) return [];

    // Get unique loan asset keys (address-chainId) that have markets
    const loanAssetKeys = new Set(markets.map((m) => `${m.loanAsset.address.toLowerCase()}-${m.morphoBlue.chain.id}`));

    // Filter allTokens to only those with markets on CoW-supported chains
    return allTokens
      .flatMap((token) =>
        token.networks
          .filter((net) => COW_SWAP_CHAINS.includes(net.chain.id as (typeof COW_SWAP_CHAINS)[number]))
          .filter((net) => loanAssetKeys.has(`${net.address.toLowerCase()}-${net.chain.id}`))
          .map((net) => ({
            address: net.address,
            symbol: token.symbol,
            chainId: net.chain.id,
            decimals: token.decimals,
            img: token.img,
          })),
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [allTokens, markets]);

  // Filter source tokens: exclude selected target (same token on same chain)
  const availableSourceTokens = useMemo<SwapToken[]>(() => {
    if (!targetToken) return sourceTokens;
    return sourceTokens.filter(
      (t) => !(t.chainId === targetToken.chainId && t.address.toLowerCase() === targetToken.address.toLowerCase()),
    );
  }, [sourceTokens, targetToken]);

  // Filter target tokens: exclude selected source (same token on same chain)
  const availableTargetTokens = useMemo<SwapToken[]>(() => {
    if (!sourceToken) return targetTokens;
    return targetTokens.filter(
      (t) => !(t.chainId === sourceToken.chainId && t.address.toLowerCase() === sourceToken.address.toLowerCase()),
    );
  }, [targetTokens, sourceToken]);

  // CoW Swap hook
  const { quote, isQuoting, isExecuting, error, orderUid, chainsMatch, executeSwap, reset } = useCowSwap({
    sourceToken,
    targetToken,
    amount,
    slippageBps: Math.round(slippage * 100),
  });

  // Check if approval is needed
  const needsApproval = allowance < amount && amount > BigInt(0);

  // Check if chains match (for showing warning)
  const showChainMismatch = sourceToken && targetToken && !chainsMatch;

  const handleSourceTokenSelect = (token: SwapToken) => {
    setSourceToken(token);
    setAmount(BigInt(0));
    setInputAmount('0');
  };

  const handleTargetTokenSelect = (token: SwapToken) => {
    setTargetToken(token);
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
    setTargetToken(defaultTargetToken ?? null);
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
    if (!targetToken) return 'Select token below';
    if (!sourceToken) return 'Select token above';
    if (showChainMismatch) {
      return <span className="text-xs text-orange-600 dark:text-orange-400">Select source on {getNetworkName(targetToken.chainId)}</span>;
    }
    if (amount === BigInt(0)) return '0';
    if (isQuoting) return 'Loading...';
    if (error) return <span className="text-xs text-orange-600 dark:text-orange-400">{formatErrorMessage(error)}</span>;
    if (quote) return <span className="text-lg">{Number(formatUnits(quote.buyAmount, targetToken.decimals)).toFixed(6)}</span>;
    return '0';
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="lg"
    >
      <ModalHeader
        title="Swap"
        description={targetToken ? `Swap to ${targetToken.symbol} via CoW Protocol` : 'Swap tokens via CoW Protocol'}
        mainIcon={
          <div className="h-8 w-8 overflow-hidden rounded-full">
            <Image
              src="/imgs/protocols/cow.png"
              alt="CoW Protocol"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
        }
      />

      <ModalBody>
        <div className="space-y-4">
          {/* From Section */}
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
                className="h-10 flex-1 rounded-sm bg-hovered px-3 text-lg focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <TokenNetworkDropdown
                selectedToken={sourceToken}
                tokens={availableSourceTokens}
                onSelect={handleSourceTokenSelect}
                placeholder="Select"
                disabled={availableSourceTokens.length === 0}
                highlightChainId={targetToken?.chainId}
              />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowDownIcon className="h-5 w-5 text-secondary" />
          </div>

          {/* To Section */}
          <div>
            <div className="mb-1.5 text-xs text-secondary">To</div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-sm bg-hovered px-3 text-xs text-secondary">{getOutputDisplay()}</div>
              <TokenNetworkDropdown
                selectedToken={targetToken}
                tokens={availableTargetTokens}
                onSelect={handleTargetTokenSelect}
                placeholder="Select"
                disabled={availableTargetTokens.length === 0}
              />
            </div>
            <div className="mt-1.5 text-xs text-secondary">
              {quote && sourceToken && targetToken && !error && chainsMatch && (
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

          {/* Chain Mismatch Warning */}
          {showChainMismatch && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded bg-orange-50 p-3 text-sm dark:bg-orange-900/20"
            >
              <span className="text-xs text-orange-700 dark:text-orange-300">
                Select a source token on {getNetworkName(targetToken.chainId)} to swap
              </span>
            </motion.div>
          )}

          {/* Error Display */}
          {error && !showChainMismatch && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded bg-orange-50 p-3 text-sm dark:bg-orange-900/20"
            >
              <span className="text-xs text-orange-700 dark:text-orange-300">{formatErrorMessage(error)}</span>
            </motion.div>
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
                <span className="text-xs text-secondary">Order Created</span>
                <a
                  href={`https://explorer.cow.fi/orders/${orderUid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline hover:opacity-80"
                >
                  View in CoW Explorer
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {!balancesLoading && sourceTokens.length === 0 && (
            <div className="py-6 text-center text-sm text-secondary">
              <p>No tokens found on supported chains</p>
              <p className="mt-1 text-xs opacity-70">Supported: Ethereum, Base, Arbitrum</p>
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
            skipChainCheck={!sourceToken || !targetToken || amount === BigInt(0) || !chainsMatch}
            onClick={() => void handleSwap()}
            isLoading={isLoading}
            disabled={!sourceToken || !targetToken || !quote || amount === BigInt(0) || !!error || !chainsMatch}
            variant="primary"
          >
            {needsApproval ? 'Approve & Swap' : 'Swap'}
          </ExecuteTransactionButton>
        )}
      </ModalFooter>
    </Modal>
  );
}
