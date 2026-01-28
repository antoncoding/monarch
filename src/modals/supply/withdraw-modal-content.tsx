// Import the necessary hooks
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import { publicAllocatorAbi } from '@/abis/public-allocator';
import Input from '@/components/Input/Input';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatReadable, min } from '@/utils/balance';
import { getMorphoAddress } from '@/utils/morpho';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';

type WithdrawPhase = 'idle' | 'sourcing' | 'withdrawing';

type WithdrawModalContentProps = {
  position?: MarketPosition | null;
  market?: Market;
  onClose: () => void;
  refetch: () => void;
  onAmountChange?: (amount: bigint) => void;
  liquiditySourcing?: LiquiditySourcingResult;
};

export function WithdrawModalContent({ position, market, onClose, refetch, onAmountChange, liquiditySourcing }: WithdrawModalContentProps): JSX.Element {
  const toast = useStyledToast();
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));
  const [withdrawPhase, setWithdrawPhase] = useState<WithdrawPhase>('idle');

  // Notify parent component when withdraw amount changes
  const handleWithdrawAmountChange = useCallback(
    (amount: bigint) => {
      setWithdrawAmount(amount);
      onAmountChange?.(amount);
    },
    [onAmountChange],
  );
  const { address: account, chainId } = useConnection();
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  // Prefer the market prop (which has fresh state) over position.market
  const activeMarket = market ?? position?.market;

  // Compute effective max amount with PA extra liquidity
  const marketLiquidity = BigInt(activeMarket?.state.liquidityAssets ?? 0);
  const extraLiquidity = liquiditySourcing?.totalAvailableExtraLiquidity ?? 0n;
  const effectiveLiquidity = marketLiquidity + extraLiquidity;
  const supplyAssets = BigInt(position?.state.supplyAssets ?? 0);
  const effectiveMax = position ? min(supplyAssets, effectiveLiquidity) : 0n;

  // Whether this withdraw needs PA sourcing
  const needsSourcing = withdrawAmount > marketLiquidity && withdrawAmount > 0n && liquiditySourcing?.canSourceLiquidity;

  // ── Transaction hook for sourcing step (Step 1) ──
  const { isConfirming: isSourceConfirming, sendTransactionAsync: sendSourceTxAsync } = useTransactionWithToast({
    toastId: 'source-liquidity-withdraw',
    pendingText: 'Sourcing Liquidity',
    successText: 'Liquidity Sourced',
    errorText: 'Failed to source liquidity',
    chainId,
    pendingDescription: 'Moving liquidity via the Public Allocator...',
    successDescription: 'Liquidity is now available. Proceeding to withdraw...',
    onSuccess: () => {
      // After sourcing succeeds, automatically trigger withdraw
      setWithdrawPhase('withdrawing');
    },
  });

  // ── Transaction hook for withdraw step (Step 2 or direct) ──
  const { isConfirming: isWithdrawConfirming, sendTransaction: sendWithdrawTx } = useTransactionWithToast({
    toastId: 'withdraw',
    pendingText: activeMarket
      ? `Withdrawing ${formatBalance(withdrawAmount, activeMarket.loanAsset.decimals)} ${activeMarket.loanAsset.symbol}`
      : '',
    successText: activeMarket ? `${activeMarket.loanAsset.symbol} Withdrawn` : '',
    errorText: 'Failed to withdraw',
    chainId,
    pendingDescription: activeMarket ? `Withdrawing from market ${activeMarket.uniqueKey.slice(2, 8)}...` : '',
    successDescription: activeMarket ? `Successfully withdrawn from market ${activeMarket.uniqueKey.slice(2, 8)}` : '',
    onSuccess: () => {
      setWithdrawPhase('idle');
      refetch();
      onClose();
    },
  });

  // ── Execute the withdraw transaction (shared between direct and 2-step flows) ──
  const executeWithdraw = useCallback(() => {
    if (!activeMarket || !account) return;

    let assetsToWithdraw: string;
    let sharesToWithdraw: string;

    if (position) {
      const isMax = withdrawAmount.toString() === position.state.supplyAssets.toString();
      assetsToWithdraw = isMax ? '0' : withdrawAmount.toString();
      sharesToWithdraw = isMax ? position.state.supplyShares : '0';
    } else {
      assetsToWithdraw = withdrawAmount.toString();
      sharesToWithdraw = '0';
    }

    sendWithdrawTx({
      account,
      to: getMorphoAddress(activeMarket.morphoBlue.chain.id as SupportedNetworks),
      data: encodeFunctionData({
        abi: morphoAbi,
        functionName: 'withdraw',
        args: [
          {
            loanToken: activeMarket.loanAsset.address as Address,
            collateralToken: activeMarket.collateralAsset.address as Address,
            oracle: activeMarket.oracleAddress as Address,
            irm: activeMarket.irmAddress as Address,
            lltv: BigInt(activeMarket.lltv),
          },
          BigInt(assetsToWithdraw),
          BigInt(sharesToWithdraw),
          account, // onBehalf
          account, // receiver
        ],
      }),
      chainId: activeMarket.morphoBlue.chain.id,
    });
  }, [account, activeMarket, position, withdrawAmount, sendWithdrawTx]);

  // ── Main withdraw handler ──
  const handleWithdraw = useCallback(async () => {
    if (!activeMarket) {
      toast.error('No market', 'Market data not available');
      return;
    }

    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    if (needsSourcing && liquiditySourcing) {
      // 2-step flow: source liquidity first
      const extraNeeded = withdrawAmount - marketLiquidity;
      const reallocation = liquiditySourcing.computeReallocation(extraNeeded);

      if (!reallocation) {
        toast.error('Cannot source liquidity', 'Unable to find a vault with enough available liquidity.');
        return;
      }

      const allocatorAddress = PUBLIC_ALLOCATOR_ADDRESSES[activeMarket.morphoBlue.chain.id as SupportedNetworks];
      if (!allocatorAddress) {
        toast.error('Not supported', 'Public Allocator is not available on this network.');
        return;
      }

      setWithdrawPhase('sourcing');

      try {
        await switchChainAsync({ chainId: activeMarket.morphoBlue.chain.id });

        // Step 1: Call reallocateTo on the public allocator contract directly
        const sortedWithdrawals = reallocation.withdrawals.map(({ marketParams, amount }) => ({
          marketParams,
          amount,
        }));

        await sendSourceTxAsync({
          to: allocatorAddress,
          data: encodeFunctionData({
            abi: publicAllocatorAbi,
            functionName: 'reallocateTo',
            args: [reallocation.vaultAddress, sortedWithdrawals, reallocation.targetMarketParams],
          }),
          value: reallocation.fee,
          chainId: activeMarket.morphoBlue.chain.id,
        });

        // onSuccess of the source tx hook will set phase to 'withdrawing'
        // and we trigger step 2 from the effect below
      } catch (error) {
        setWithdrawPhase('idle');
        console.error('Error during liquidity sourcing:', error);
        if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
          toast.error('Sourcing Failed', 'Failed to source liquidity from the Public Allocator.');
        }
      }
    } else {
      // Direct withdraw (no sourcing needed)
      executeWithdraw();
    }
  }, [account, activeMarket, needsSourcing, liquiditySourcing, withdrawAmount, marketLiquidity, executeWithdraw, sendSourceTxAsync, switchChainAsync, toast]);

  const handleWithdrawClick = useCallback(() => {
    void handleWithdraw();
  }, [handleWithdraw]);

  // Auto-trigger step 2 when sourcing completes
  const hasAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (withdrawPhase === 'withdrawing' && !isWithdrawConfirming && !hasAutoTriggeredRef.current) {
      hasAutoTriggeredRef.current = true;
      executeWithdraw();
    }
    if (withdrawPhase === 'idle') {
      hasAutoTriggeredRef.current = false;
    }
  }, [withdrawPhase, isWithdrawConfirming, executeWithdraw]);

  // Manual retry if step 2 fails after sourcing succeeded
  const handleRetryWithdraw = useCallback(() => {
    hasAutoTriggeredRef.current = true;
    executeWithdraw();
  }, [executeWithdraw]);

  // Compute the reallocation plan for display (memoized)
  const reallocationPlan = useMemo(() => {
    if (!needsSourcing || !liquiditySourcing) return null;
    const extraNeeded = withdrawAmount - marketLiquidity;
    return liquiditySourcing.computeReallocation(extraNeeded);
  }, [needsSourcing, liquiditySourcing, withdrawAmount, marketLiquidity]);

  const isLoading = isSourceConfirming || isWithdrawConfirming;

  if (!activeMarket) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-center text-red-500">Market data not available</p>
      </div>
    );
  }

  // Phase-based button text
  const getButtonText = () => {
    if (withdrawPhase === 'sourcing') return 'Step 1/2: Sourcing...';
    if (withdrawPhase === 'withdrawing') return 'Step 2/2: Withdrawing...';
    if (needsSourcing) return 'Source & Withdraw';
    return 'Withdraw';
  };

  return (
    <div className="flex flex-col">
      {/* Withdraw Input Section */}
      <div className="mt-12 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="opacity-80">Withdraw amount</span>
            <div className="flex flex-col items-end gap-1">
              <p className="font-inter text-xs opacity-50">
                Available: {formatReadable(formatBalance(position?.state.supplyAssets ?? BigInt(0), activeMarket.loanAsset.decimals))}{' '}
                {activeMarket.loanAsset.symbol}
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-start justify-between">
            <div className="relative flex-grow">
              <Input
                decimals={activeMarket.loanAsset.decimals}
                max={effectiveMax}
                setValue={handleWithdrawAmountChange}
                setError={setInputError}
                exceedMaxErrMessage={extraLiquidity > 0n ? 'Exceeds available liquidity (incl. PA)' : 'Insufficient Liquidity'}
                allowExceedMax={true}
                error={inputError}
              />

              {/* Sourcing indicator */}
              {needsSourcing && reallocationPlan && (
                <p className="mt-1 text-xs text-blue-500">
                  ⚡ Will source extra liquidity from {reallocationPlan.vaultName}
                  {reallocationPlan.fee > 0n && (
                    <span className="ml-1 opacity-70">
                      (fee: {formatBalance(reallocationPlan.fee, 18)} ETH)
                    </span>
                  )}
                </p>
              )}

              {/* Phase progress for 2-step flow */}
              {withdrawPhase === 'withdrawing' && !isWithdrawConfirming && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-green-600">✓ Liquidity sourced. </p>
                  <button
                    type="button"
                    onClick={handleRetryWithdraw}
                    className="text-xs font-medium text-blue-500 hover:text-blue-600"
                  >
                    Execute Withdraw →
                  </button>
                </div>
              )}
            </div>

            <ExecuteTransactionButton
              targetChainId={activeMarket.morphoBlue.chain.id}
              onClick={withdrawPhase === 'withdrawing' ? handleRetryWithdraw : handleWithdrawClick}
              isLoading={isLoading}
              disabled={!withdrawAmount || (withdrawPhase === 'idle' && !!inputError)}
              variant="primary"
              className="ml-2 min-w-32"
            >
              {getButtonText()}
            </ExecuteTransactionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
