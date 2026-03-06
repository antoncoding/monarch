import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownIcon } from '@radix-ui/react-icons';
import { IoIosSwap } from 'react-icons/io';
import { formatUnits, isAddress, parseUnits, zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import { motion } from 'framer-motion';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { useUserBalancesQuery } from '@/hooks/queries/useUserBalancesQuery';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useAllowance } from '@/hooks/useAllowance';
import { formatTokenAmountPreview, withSlippageFloor } from '@/hooks/leverage/math';
import { formatBalance } from '@/utils/balance';
import { isValidDecimalInput, sanitizeDecimalInput, toParseableDecimalInput } from '@/utils/decimal-input';
import { formatCompactTokenAmount } from '@/utils/token-amount-format';
import { useVeloraSwap } from '../hooks/useVeloraSwap';
import { SlippageInlineEditor } from './SlippageInlineEditor';
import { TokenNetworkDropdown } from './TokenNetworkDropdown';
import { SwapTokenAmountField } from './SwapTokenAmountField';
import { VELORA_SWAP_CHAINS, type SwapToken } from '../types';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '../constants';
import { formatSwapRatePreview } from '../utils/quote-preview';

type SwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetToken?: SwapToken;
};

const DEFAULT_CHAIN_ID = 1;

export function SwapModal({ isOpen, onClose, defaultTargetToken }: SwapModalProps) {
  const { address: account } = useConnection();
  const [sourceToken, setSourceToken] = useState<SwapToken | null>(null);
  const [targetToken, setTargetToken] = useState<SwapToken | null>(defaultTargetToken ?? null);
  const [inputAmount, setInputAmount] = useState<string>('0');
  const [amount, setAmount] = useState<bigint>(BigInt(0));
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);
  const [isRateInverted, setIsRateInverted] = useState(false);
  const swapSlippageBps = useMemo(() => slippagePercentToBps(slippage), [slippage]);
  const amountInputClassName =
    'h-10 w-full rounded bg-hovered px-3 pr-44 text-lg font-medium tabular-nums focus:border-primary focus:outline-none';

  // Fetch user balances from Velora-supported chains
  const {
    data: balances = [],
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = useUserBalancesQuery({
    networkIds: VELORA_SWAP_CHAINS as unknown as number[],
  });

  // Fetch all tokens for target selection
  const { allTokens } = useTokensQuery();

  // Fetch markets to filter target tokens
  const { data: markets } = useMarketsQuery();

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

  useEffect(() => {
    if (balancesLoading) return;
    if (!sourceToken) return;

    const refreshedSourceToken = sourceTokens.find(
      (token) => token.chainId === sourceToken.chainId && token.address.toLowerCase() === sourceToken.address.toLowerCase(),
    );

    if (!refreshedSourceToken) {
      setSourceToken(null);
      return;
    }

    if (
      refreshedSourceToken.balance !== sourceToken.balance ||
      refreshedSourceToken.decimals !== sourceToken.decimals ||
      refreshedSourceToken.symbol !== sourceToken.symbol
    ) {
      setSourceToken(refreshedSourceToken);
    }
  }, [balancesLoading, sourceToken, sourceTokens]);

  // Target tokens: all tokens with Morpho markets on Velora-supported chains
  const targetTokens = useMemo<SwapToken[]>(() => {
    if (!markets) return [];

    // Get unique loan asset keys (address-chainId) that have markets
    const loanAssetKeys = new Set(markets.map((m) => `${m.loanAsset.address.toLowerCase()}-${m.morphoBlue.chain.id}`));

    // Filter allTokens to only those with markets on Velora-supported chains
    return allTokens
      .flatMap((token) =>
        token.networks
          .filter((net) => VELORA_SWAP_CHAINS.includes(net.chain.id as (typeof VELORA_SWAP_CHAINS)[number]))
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
    return targetTokens.filter((t) => t.chainId === sourceToken.chainId && t.address.toLowerCase() !== sourceToken.address.toLowerCase());
  }, [targetTokens, sourceToken]);

  // Velora swap hook
  const handleSwapConfirmed = useCallback(() => {
    setInputAmount('0');
    setAmount(BigInt(0));
    void refetchBalances();
  }, [refetchBalances]);

  const { quote, isQuoting, isExecuting, error, chainsMatch, approvalTarget, executeSwap, reset } = useVeloraSwap({
    sourceToken,
    targetToken,
    amount,
    slippageBps: swapSlippageBps,
    onSwapConfirmed: handleSwapConfirmed,
  });

  // Check if approval is needed
  const sourceTokenAddress =
    sourceToken?.address && isAddress(sourceToken.address) ? (sourceToken.address as `0x${string}`) : (zeroAddress as `0x${string}`);
  const spenderForAllowance =
    approvalTarget && isAddress(approvalTarget) ? (approvalTarget as `0x${string}`) : (zeroAddress as `0x${string}`);

  // Handle approval for source token
  const { allowance, approveInfinite, approvePending } = useAllowance({
    token: sourceTokenAddress,
    chainId: sourceToken?.chainId,
    user: account,
    spender: spenderForAllowance,
    tokenSymbol: sourceToken?.symbol,
  });
  const needsApproval = allowance < amount && amount > BigInt(0);

  const handleSourceTokenSelect = (token: SwapToken) => {
    if (targetToken && targetToken.chainId !== token.chainId) {
      setTargetToken(null);
    }
    setSourceToken(token);
    setAmount(BigInt(0));
    setInputAmount('0');
  };

  const handleTargetTokenSelect = (token: SwapToken) => {
    if (sourceToken && sourceToken.chainId !== token.chainId) {
      return;
    }
    setTargetToken(token);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedInput = sanitizeDecimalInput(e.target.value);
    if (!isValidDecimalInput(normalizedInput)) {
      return;
    }
    setInputAmount(normalizedInput);

    if (!sourceToken) return;

    const parseableInput = toParseableDecimalInput(normalizedInput);
    if (!parseableInput) {
      setAmount(BigInt(0));
      return;
    }

    try {
      const parsed = parseUnits(parseableInput, sourceToken.decimals);
      setAmount(parsed);
    } catch {
      // Clear parsed amount to avoid submitting a stale previous value.
      setAmount(BigInt(0));
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
    if (!sourceToken || !targetToken || !approvalTarget) return;

    if (needsApproval) {
      await approveInfinite();
    }
    await executeSwap();
  }, [sourceToken, targetToken, approvalTarget, needsApproval, approveInfinite, executeSwap]);

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
    if (amount === BigInt(0)) return '0';
    if (isQuoting) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-secondary">
          <Spinner
            size={12}
            width={2}
            color="text-secondary"
          />
          Quoting
        </span>
      );
    }
    if (quote) return <span className="text-lg">{formatCompactTokenAmount(quote.buyAmount, targetToken.decimals)}</span>;
    return '0';
  };

  const ratePreviewText = useMemo(() => {
    if (!quote || !sourceToken || !targetToken || error || !chainsMatch) return null;

    if (isRateInverted) {
      return formatSwapRatePreview({
        baseAmount: quote.buyAmount,
        baseTokenDecimals: targetToken.decimals,
        baseTokenSymbol: targetToken.symbol,
        quoteAmount: quote.sellAmount,
        quoteTokenDecimals: sourceToken.decimals,
        quoteTokenSymbol: sourceToken.symbol,
      });
    }

    return formatSwapRatePreview({
      baseAmount: quote.sellAmount,
      baseTokenDecimals: sourceToken.decimals,
      baseTokenSymbol: sourceToken.symbol,
      quoteAmount: quote.buyAmount,
      quoteTokenDecimals: targetToken.decimals,
      quoteTokenSymbol: targetToken.symbol,
    });
  }, [quote, sourceToken, targetToken, error, chainsMatch, isRateInverted]);

  const receivePreview = useMemo(() => {
    if (!quote || !targetToken || error || !chainsMatch) return null;
    return formatTokenAmountPreview(quote.buyAmount, targetToken.decimals);
  }, [quote, targetToken, error, chainsMatch]);

  const minReceivePreview = useMemo(() => {
    if (!quote || !targetToken || error || !chainsMatch) return null;
    return formatTokenAmountPreview(withSlippageFloor(quote.buyAmount, swapSlippageBps), targetToken.decimals);
  }, [quote, targetToken, error, chainsMatch, swapSlippageBps]);
  const zeroReceivePreview = useMemo(() => {
    if (!targetToken) return null;
    return formatTokenAmountPreview(0n, targetToken.decimals);
  }, [targetToken]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="xl"
    >
      <ModalHeader
        title="Swap"
        description={targetToken ? `Swap to ${targetToken.symbol} via Velora` : 'Swap tokens via Velora'}
        mainIcon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">V</div>
        }
      />

      <ModalBody>
        <div className="space-y-4">
          {/* From Section */}
          <SwapTokenAmountField
            label="From"
            field={
              <input
                type="text"
                value={inputAmount}
                onChange={handleInputChange}
                placeholder="0"
                disabled={!sourceToken}
                className={`${amountInputClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              />
            }
            dropdown={
              <TokenNetworkDropdown
                selectedToken={sourceToken}
                tokens={availableSourceTokens}
                onSelect={handleSourceTokenSelect}
                placeholder="Select"
                disabled={availableSourceTokens.length === 0}
                highlightChainId={targetToken?.chainId}
                triggerVariant="inline"
              />
            }
            footer={
              sourceToken ? (
                <div className="flex items-center justify-between text-xs text-secondary">
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="hover:text-primary"
                  >
                    Balance: {sourceToken.balance ? formatBalance(sourceToken.balance, sourceToken.decimals) : '0'} {sourceToken.symbol}
                  </button>
                </div>
              ) : null
            }
          />

          {/* Arrow */}
          <div className="flex justify-center py-0.5">
            <ArrowDownIcon className="h-5 w-5 text-secondary" />
          </div>

          {/* To Section */}
          <SwapTokenAmountField
            label="To"
            field={<div className={`${amountInputClassName} flex items-center text-sm text-secondary`}>{getOutputDisplay()}</div>}
            dropdown={
              <TokenNetworkDropdown
                selectedToken={targetToken}
                tokens={availableTargetTokens}
                onSelect={handleTargetTokenSelect}
                placeholder="Select"
                disabled={availableTargetTokens.length === 0}
                triggerVariant="inline"
              />
            }
            footer={null}
          />

          {/* Transaction Preview */}
          <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-secondary">TRANSACTION PREVIEW</p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">Est. Receive</span>
                {!targetToken || !zeroReceivePreview ? (
                  <span className="text-right">-</span>
                ) : isQuoting ? (
                  <span className="text-right">Quoting...</span>
                ) : (
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="text-xs">{(receivePreview ?? zeroReceivePreview).full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {(receivePreview ?? zeroReceivePreview).compact}
                      </span>
                    </Tooltip>
                    <TokenIcon
                      address={targetToken.address}
                      chainId={targetToken.chainId}
                      symbol={targetToken.symbol}
                      width={14}
                      height={14}
                    />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">Min Receive</span>
                {!targetToken || !zeroReceivePreview ? (
                  <span className="text-right">-</span>
                ) : isQuoting ? (
                  <span className="text-right">Quoting...</span>
                ) : (
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="text-xs">{(minReceivePreview ?? zeroReceivePreview).full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {(minReceivePreview ?? zeroReceivePreview).compact}
                      </span>
                    </Tooltip>
                    <TokenIcon
                      address={targetToken.address}
                      chainId={targetToken.chainId}
                      symbol={targetToken.symbol}
                      width={14}
                      height={14}
                    />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">Swap Quote</span>
                <span className="inline-flex items-center gap-1.5 text-right">
                  {ratePreviewText && (
                    <button
                      type="button"
                      onClick={() => setIsRateInverted((prev) => !prev)}
                      className="inline-flex shrink-0 rounded p-0.5 transition hover:bg-surface hover:text-primary"
                      aria-label="Swap price direction"
                    >
                      <IoIosSwap className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span>{ratePreviewText ?? '-'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary">Max Slippage</span>
                <SlippageInlineEditor
                  value={slippage}
                  onChange={setSlippage}
                />
              </div>
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
              <span className="text-xs text-orange-700 dark:text-orange-300">{formatErrorMessage(error)}</span>
            </motion.div>
          )}

          {/* Empty State */}
          {!balancesLoading && sourceTokens.length === 0 && (
            <div className="py-6 text-center text-sm text-secondary">
              <p>No tokens found on supported chains</p>
              <p className="mt-1 text-xs opacity-70">Supported: Ethereum, Polygon, Unichain, Base, Arbitrum</p>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          variant="default"
          onClick={handleClose}
        >
          Cancel
        </Button>
        <ExecuteTransactionButton
          targetChainId={sourceToken?.chainId ?? DEFAULT_CHAIN_ID}
          skipChainCheck={!sourceToken || !targetToken || amount === BigInt(0) || !approvalTarget}
          onClick={() => void handleSwap()}
          isLoading={isLoading}
          disabled={!sourceToken || !targetToken || !quote || amount === BigInt(0) || !!error || !chainsMatch || !approvalTarget}
          variant="primary"
        >
          {needsApproval ? 'Approve & Swap' : 'Swap'}
        </ExecuteTransactionButton>
      </ModalFooter>
    </Modal>
  );
}
