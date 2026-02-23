// Import the necessary hooks
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import { publicAllocatorAbi } from '@/abis/public-allocator';
import Input from '@/components/Input/Input';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { formatBalance, formatReadable, min } from '@/utils/balance';
import { getMorphoAddress } from '@/utils/morpho';
import { PUBLIC_ALLOCATOR_ADDRESSES } from '@/constants/public-allocator';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { TokenIcon } from '@/components/shared/token-icon';

export type WithdrawStepType = 'sourcing' | 'withdrawing';

const WITHDRAW_STEPS_WITH_SOURCING = [
  { id: 'sourcing', title: 'Source Liquidity', description: 'Moving liquidity via the Public Allocator' },
  { id: 'withdrawing', title: 'Withdraw', description: 'Withdrawing assets from the market' },
];

const WITHDRAW_STEPS_DIRECT = [{ id: 'withdrawing', title: 'Withdraw', description: 'Withdrawing assets from the market' }];

type WithdrawPhase = 'idle' | 'sourcing' | 'withdrawing';

type WithdrawModalContentProps = {
  position?: MarketPosition | null;
  market?: Market;
  onClose: () => void;
  refetch: () => void;
  onAmountChange?: (amount: bigint) => void;
  liquiditySourcing?: LiquiditySourcingResult;
};

export function WithdrawModalContent({
  position,
  market,
  onClose,
  refetch,
  onAmountChange,
  liquiditySourcing,
}: WithdrawModalContentProps): JSX.Element {
  const toast = useStyledToast();
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));
  const [withdrawPhase, setWithdrawPhase] = useState<WithdrawPhase>('idle');

  // Transaction tracking for ProcessModal
  const tracking = useTransactionTracking('withdraw');

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
      tracking.update('withdrawing');
      setWithdrawPhase('withdrawing');
    },
  });

  // ── Transaction hook for withdraw step (Step 2 or direct) ──
  const { isConfirming: isWithdrawConfirming, sendTransactionAsync: sendWithdrawTxAsync } = useTransactionWithToast({
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
  const executeWithdraw = useCallback(async () => {
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

    try {
      await sendWithdrawTxAsync({
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
      // TX submitted — ProcessModal can close, toast tracks confirmation
      tracking.complete();
    } catch (error) {
      tracking.fail();
      console.error('Error during withdraw:', error);
    }
  }, [account, activeMarket, position, withdrawAmount, sendWithdrawTxAsync, tracking]);

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

    const tokenSymbol = activeMarket.loanAsset.symbol;

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

      // Start tracking the 2-step process modal
      tracking.start(
        WITHDRAW_STEPS_WITH_SOURCING,
        {
          title: `Withdraw ${tokenSymbol}`,
          description: 'Source liquidity, then withdraw',
          tokenSymbol,
        },
        'sourcing',
      );

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
        tracking.fail();
        setWithdrawPhase('idle');
        console.error('Error during liquidity sourcing:', error);
        if (error instanceof Error && !error.message.toLowerCase().includes('rejected')) {
          toast.error('Sourcing Failed', 'Failed to source liquidity from the Public Allocator.');
        }
      }
    } else {
      // Direct withdraw (no sourcing needed)
      tracking.start(
        WITHDRAW_STEPS_DIRECT,
        {
          title: `Withdraw ${tokenSymbol}`,
          tokenSymbol,
        },
        'withdrawing',
      );

      await executeWithdraw();
    }
  }, [
    account,
    activeMarket,
    needsSourcing,
    liquiditySourcing,
    withdrawAmount,
    marketLiquidity,
    executeWithdraw,
    sendSourceTxAsync,
    switchChainAsync,
    toast,
    tracking,
  ]);

  const handleWithdrawClick = useCallback(() => {
    void handleWithdraw();
  }, [handleWithdraw]);

  // Auto-trigger step 2 when sourcing completes
  const hasAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (withdrawPhase === 'withdrawing' && !isWithdrawConfirming && !hasAutoTriggeredRef.current) {
      hasAutoTriggeredRef.current = true;
      void executeWithdraw();
    }
    if (withdrawPhase === 'idle') {
      hasAutoTriggeredRef.current = false;
    }
  }, [withdrawPhase, isWithdrawConfirming, executeWithdraw]);

  // Compute the reallocation plan for display (memoized)
  const reallocationPlan = useMemo(() => {
    if (!needsSourcing || !liquiditySourcing) return null;
    const extraNeeded = withdrawAmount - marketLiquidity;
    return liquiditySourcing.computeReallocation(extraNeeded);
  }, [needsSourcing, liquiditySourcing, withdrawAmount, marketLiquidity]);

  const isLoading = isSourceConfirming || isWithdrawConfirming;
  const amountInputClassName = 'h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums';

  if (!activeMarket) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-center text-red-500">Market data not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mt-5 space-y-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Withdraw</p>
        </div>

        <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
          <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
            Withdraw {activeMarket.loanAsset.symbol}
          </p>
          <Input
            decimals={activeMarket.loanAsset.decimals}
            max={effectiveMax}
            setValue={handleWithdrawAmountChange}
            setError={setInputError}
            exceedMaxErrMessage={extraLiquidity > 0n ? 'Exceeds available liquidity (incl. PA)' : 'Insufficient Liquidity'}
            allowExceedMax={true}
            error={inputError}
            value={withdrawAmount}
            inputClassName={amountInputClassName}
            endAdornment={
              <TokenIcon
                address={activeMarket.loanAsset.address}
                chainId={activeMarket.morphoBlue.chain.id}
                symbol={activeMarket.loanAsset.symbol}
                width={16}
                height={16}
              />
            }
          />
          <p className="mt-1 text-right text-xs text-secondary">
            Available: {formatReadable(formatBalance(position?.state.supplyAssets ?? 0n, activeMarket.loanAsset.decimals))}{' '}
            {activeMarket.loanAsset.symbol}
          </p>

          {needsSourcing && reallocationPlan && (
            <p className="mt-1 text-right text-xs text-blue-500">
              ⚡ Will source extra liquidity from {reallocationPlan.vaultName}
              {reallocationPlan.fee > 0n && <span className="ml-1 opacity-70">(fee: {formatBalance(reallocationPlan.fee, 18)} ETH)</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-end">
          <ExecuteTransactionButton
            targetChainId={activeMarket.morphoBlue.chain.id}
            onClick={handleWithdrawClick}
            isLoading={isLoading}
            disabled={!withdrawAmount || !!inputError}
            variant="primary"
            className="min-w-32"
          >
            Withdraw
          </ExecuteTransactionButton>
        </div>
      </div>
    </div>
  );
}
