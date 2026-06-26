import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnection } from 'wagmi';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Tooltip } from '@/components/ui/tooltip';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { SlippageInlineEditor } from '@/features/swap/components/SlippageInlineEditor';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '@/features/swap/constants';
import { formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import {
  clampTargetLtvBps,
  computeDebtAdjustmentForTargetLtv,
  computeDeleverageProjectedPosition,
  formatTokenAmountPreview,
  ltvWadToBps,
  parseUnsignedBigInt,
  WAD_TO_BPS_SCALE,
  withSlippageInverseCeil,
} from '@/hooks/leverage/math';
import { useDeleverageQuote } from '@/hooks/useDeleverageQuote';
import { useDeleverageTransaction } from '@/hooks/useDeleverageTransaction';
import type { Market, MarketPosition } from '@/utils/types';
import type { LeverageRoute } from '@/hooks/leverage/types';
import {
  computeLtv,
  computeRequiredCollateralAssets,
  formatLtvPercent,
  getCollateralValueInLoan,
  getLTVColor,
  LTV_WAD,
} from '@/modals/borrow/components/helpers';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import { PreviewSectionHeader } from '@/modals/borrow/components/preview-section-header';

type RemoveCollateralAndDeleverageProps = {
  market: Market;
  route: LeverageRoute | null;
  currentPosition: MarketPosition | null;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

export function RemoveCollateralAndDeleverage({
  market,
  route,
  currentPosition,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: RemoveCollateralAndDeleverageProps): JSX.Element {
  const { address: account } = useConnection();
  const isSwapRoute = route?.kind === 'swap';
  const [targetLtvBps, setTargetLtvBps] = useState<bigint | null>(null);
  const [swapSlippagePercent, setSwapSlippagePercent] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);

  const currentCollateralAssetsRaw = parseUnsignedBigInt(currentPosition?.state.collateral);
  const currentBorrowAssetsRaw = parseUnsignedBigInt(currentPosition?.state.borrowAssets);
  const currentBorrowSharesRaw = parseUnsignedBigInt(currentPosition?.state.borrowShares);
  const lltvRaw = parseUnsignedBigInt(market.lltv);
  const hasInvalidPositionData =
    currentCollateralAssetsRaw == null || currentBorrowAssetsRaw == null || currentBorrowSharesRaw == null || lltvRaw == null;
  const currentCollateralAssets = currentCollateralAssetsRaw ?? 0n;
  const currentBorrowAssets = currentBorrowAssetsRaw ?? 0n;
  const currentBorrowShares = currentBorrowSharesRaw ?? 0n;
  const lltv = lltvRaw ?? 0n;
  const currentLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: currentBorrowAssets,
        collateralAssets: currentCollateralAssets,
        oraclePrice,
      }),
    [currentBorrowAssets, currentCollateralAssets, oraclePrice],
  );
  const currentLtvBps = useMemo(() => ltvWadToBps(currentLTV), [currentLTV]);
  const effectiveTargetLtvBps = targetLtvBps ?? currentLtvBps;
  const currentCollateralValueInLoan = useMemo(
    () => getCollateralValueInLoan(currentCollateralAssets, oraclePrice),
    [currentCollateralAssets, oraclePrice],
  );
  const targetDebtAdjustment = useMemo(
    () =>
      computeDebtAdjustmentForTargetLtv({
        currentBorrowAssets,
        currentCollateralValueInLoan,
        targetLtv: effectiveTargetLtvBps * WAD_TO_BPS_SCALE,
      }),
    [currentBorrowAssets, currentCollateralValueInLoan, effectiveTargetLtvBps],
  );
  const swapSlippageBps = useMemo(() => slippagePercentToBps(swapSlippagePercent), [swapSlippagePercent]);
  const targetRepayAmount =
    effectiveTargetLtvBps === 0n
      ? currentBorrowAssets
      : targetDebtAdjustment.direction === 'decrease'
        ? targetDebtAdjustment.amount > currentBorrowAssets
          ? currentBorrowAssets
          : targetDebtAdjustment.amount
        : 0n;
  const targetRepayAmountWithSlippage = withSlippageInverseCeil(targetRepayAmount, swapSlippageBps);
  const targetWithdrawCollateralAmount =
    effectiveTargetLtvBps === 0n
      ? currentCollateralAssets
      : computeRequiredCollateralAssets({
          // WHY: this is only the seed amount for the route quote. The risk preview below remains
          // authoritative because the live swap/vault quote can move after slippage and fees.
          borrowAssets: targetRepayAmountWithSlippage,
          oraclePrice,
          targetLtv: LTV_WAD,
        });
  const withdrawCollateralAmount =
    targetWithdrawCollateralAmount > currentCollateralAssets ? currentCollateralAssets : targetWithdrawCollateralAmount;
  const quoteWithdrawCollateralAmount = hasInvalidPositionData ? 0n : withdrawCollateralAmount;

  const quote = useDeleverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    withdrawCollateralAmount: quoteWithdrawCollateralAmount,
    currentBorrowAssets,
    currentBorrowShares,
    loanTokenAddress: market.loanAsset.address,
    loanTokenDecimals: market.loanAsset.decimals,
    collateralTokenAddress: market.collateralAsset.address,
    collateralTokenDecimals: market.collateralAsset.decimals,
    userAddress: account as `0x${string}` | undefined,
    slippageBps: swapSlippageBps,
  });

  const closeRoutePendingResolution = route?.kind === 'swap' && quote.closeRouteRequiresResolution && quote.canCurrentSellCloseDebt;
  const closeRouteAvailableForPreview = quote.closeRouteAvailable || closeRoutePendingResolution;
  const closeBoundForPreview = closeRoutePendingResolution ? withdrawCollateralAmount : quote.maxCollateralForDebtRepay;

  const projection = useMemo(
    () =>
      computeDeleverageProjectedPosition({
        currentCollateralAssets,
        currentBorrowAssets,
        currentBorrowShares,
        withdrawCollateralAmount,
        repayAmount: quote.repayAmount,
        maxCollateralForDebtRepay: closeBoundForPreview,
        closeRouteAvailable: closeRouteAvailableForPreview,
        closeBoundIsInputCap: route?.kind !== 'swap',
        slippageBps: swapSlippageBps,
      }),
    [
      currentCollateralAssets,
      currentBorrowAssets,
      currentBorrowShares,
      withdrawCollateralAmount,
      quote.repayAmount,
      closeBoundForPreview,
      closeRouteAvailableForPreview,
      swapSlippageBps,
      route,
    ],
  );

  const projectedLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: projection.projectedBorrowAssets,
        collateralAssets: projection.projectedCollateralAssets,
        oraclePrice,
      }),
    [projection.projectedBorrowAssets, projection.projectedCollateralAssets, oraclePrice],
  );
  const settledProjectedLtvRef = useRef(projectedLTV);

  useEffect(() => {
    if (quote.isLoading || quote.error) return;
    settledProjectedLtvRef.current = projectedLTV;
  }, [quote.isLoading, quote.error, projectedLTV]);

  const handleTransactionSuccess = useCallback(() => {
    // WHY: clear unwind draft after confirmation so users see the refreshed live position, not stale input.
    setTargetLtvBps(null);
    if (onSuccess) onSuccess();
  }, [onSuccess]);

  const {
    transaction,
    isLoading: deleverageFlowLoading,
    authorizeAndDeleverage,
    executionError,
    clearExecutionError,
  } = useDeleverageTransaction({
    market,
    route,
    withdrawCollateralAmount,
    maxWithdrawCollateralAmount: projection.maxWithdrawCollateral,
    flashLoanAmount: projection.flashLoanAmountForTx,
    repayBySharesAmount: projection.repayBySharesAmount,
    useCloseRoute: projection.usesCloseRoute,
    autoWithdrawCollateralAmount: projection.autoWithdrawCollateralAmount,
    maxCollateralForDebtRepay: quote.maxCollateralForDebtRepay,
    swapSellPriceRoute: quote.swapSellPriceRoute,
    slippageBps: swapSlippageBps,
    onSuccess: handleTransactionSuccess,
  });

  const handleDeleverage = useCallback(() => {
    if (
      hasInvalidPositionData ||
      targetDebtAdjustment.direction === 'increase' ||
      quote.closeRouteRequiresResolution ||
      withdrawCollateralAmount > projection.maxWithdrawCollateral
    ) {
      return;
    }
    void authorizeAndDeleverage();
  }, [
    hasInvalidPositionData,
    targetDebtAdjustment.direction,
    quote.closeRouteRequiresResolution,
    withdrawCollateralAmount,
    projection.maxWithdrawCollateral,
    authorizeAndDeleverage,
  ]);

  // Treat user input as an intent change immediately so the preview card updates as soon as the amount changes.
  const hasChanges = withdrawCollateralAmount > 0n;
  const previewHasTransientState = hasChanges && (quote.isLoading || quote.error !== null);
  const displayProjectedLTV = previewHasTransientState ? settledProjectedLtvRef.current : projectedLTV;
  const shouldShowProjectedRisk = hasChanges && !previewHasTransientState;
  const exceedsMaxWithdraw = withdrawCollateralAmount > projection.maxWithdrawCollateral;
  const targetNeedsLeverage = targetDebtAdjustment.direction === 'increase';
  const projectedOverLimit = displayProjectedLTV >= lltv;
  const flashBorrowPreview = useMemo(
    () => formatTokenAmountPreview(projection.flashLoanAmountForTx, market.loanAsset.decimals),
    [projection.flashLoanAmountForTx, market.loanAsset.decimals],
  );
  const debtRepaidPreview = useMemo(
    () => formatTokenAmountPreview(projection.previewDebtRepaid, market.loanAsset.decimals),
    [projection.previewDebtRepaid, market.loanAsset.decimals],
  );
  const unwindCollateralPreview = useMemo(
    () => formatTokenAmountPreview(withdrawCollateralAmount, market.collateralAsset.decimals),
    [withdrawCollateralAmount, market.collateralAsset.decimals],
  );
  const collateralFlowLabel = isSwapRoute ? 'Collateral Sold' : 'Collateral Unwound';

  const handleSwapSlippageChange = useCallback(
    (nextSlippagePercent: number) => {
      clearExecutionError();
      setSwapSlippagePercent(nextSlippagePercent);
    },
    [clearExecutionError],
  );

  const swapRatePreviewText = useMemo(() => {
    if (!isSwapRoute || !quote.swapSellPriceRoute) return null;

    let quotedCollateralIn: bigint;
    let quotedLoanOut: bigint;
    try {
      quotedCollateralIn = BigInt(quote.swapSellPriceRoute.srcAmount);
      quotedLoanOut = BigInt(quote.swapSellPriceRoute.destAmount);
    } catch {
      return null;
    }

    return formatSwapRatePreview({
      baseAmount: quotedCollateralIn,
      baseTokenDecimals: market.collateralAsset.decimals,
      baseTokenSymbol: market.collateralAsset.symbol,
      quoteAmount: quotedLoanOut,
      quoteTokenDecimals: market.loanAsset.decimals,
      quoteTokenSymbol: market.loanAsset.symbol,
    });
  }, [
    isSwapRoute,
    quote.swapSellPriceRoute,
    market.collateralAsset.decimals,
    market.collateralAsset.symbol,
    market.loanAsset.decimals,
    market.loanAsset.symbol,
  ]);
  const shouldShowSwapPreviewDetails = isSwapRoute && quote.swapSellPriceRoute != null && swapRatePreviewText != null;
  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <PreviewSectionHeader
            title="Decrease LTV Preview"
            onRefresh={onSuccess}
            isRefreshing={isRefreshing}
          />
          <BorrowPositionRiskCard
            market={market}
            oraclePrice={oraclePrice}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            projectedCollateral={projection.projectedCollateralAssets}
            projectedBorrow={projection.projectedBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={displayProjectedLTV}
            lltv={lltv}
            hasChanges={shouldShowProjectedRisk}
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Target LTV</p>
              <Input
                decimals={2}
                setValue={(nextTargetLtvBps) => {
                  clearExecutionError();
                  setTargetLtvBps(clampTargetLtvBps(nextTargetLtvBps));
                }}
                value={effectiveTargetLtvBps}
                inputClassName="h-10 rounded bg-surface px-3 py-2 pr-10 text-base font-medium tabular-nums"
                endAdornment={<span className="text-xs text-secondary">%</span>}
                debounceSetValueMs={300}
              />
              <p className="mt-1 text-right text-xs text-secondary">Current: {formatLtvPercent(currentLTV)}%</p>
              {targetNeedsLeverage && <p className="mt-1 text-right text-xs text-red-500">Select Increase LTV to target a higher LTV.</p>}
              {exceedsMaxWithdraw && <p className="mt-1 text-right text-xs text-red-500">Exceeds deleverageable collateral</p>}
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Transaction Preview</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{collateralFlowLabel}</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="font-monospace text-xs">{unwindCollateralPreview.full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">{unwindCollateralPreview.compact}</span>
                    </Tooltip>
                    <TokenIcon
                      address={market.collateralAsset.address}
                      chainId={market.morphoBlue.chain.id}
                      symbol={market.collateralAsset.symbol}
                      width={14}
                      height={14}
                    />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Flash Borrow</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="font-monospace text-xs">{flashBorrowPreview.full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">{flashBorrowPreview.compact}</span>
                    </Tooltip>
                    <TokenIcon
                      address={market.loanAsset.address}
                      chainId={market.morphoBlue.chain.id}
                      symbol={market.loanAsset.symbol}
                      width={14}
                      height={14}
                    />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Debt Repaid</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="font-monospace text-xs">{debtRepaidPreview.full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">{debtRepaidPreview.compact}</span>
                    </Tooltip>
                    <TokenIcon
                      address={market.loanAsset.address}
                      chainId={market.morphoBlue.chain.id}
                      symbol={market.loanAsset.symbol}
                      width={14}
                      height={14}
                    />
                  </span>
                </div>
                {shouldShowSwapPreviewDetails && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-secondary">Swap Quote</span>
                      <span className="text-right">{swapRatePreviewText}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary">Max Slippage</span>
                      <SlippageInlineEditor
                        value={swapSlippagePercent}
                        onChange={handleSwapSlippageChange}
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Projected LTV</span>
                  <span className={`tabular-nums ${getLTVColor(displayProjectedLTV, lltv)}`}>{formatLtvPercent(displayProjectedLTV)}%</span>
                </div>
              </div>
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
              {executionError && <p className="mt-2 text-xs text-red-500">{executionError}</p>}
              {hasInvalidPositionData && (
                <p className="mt-2 text-xs text-red-500">Unable to read valid position data. Refresh balances and try again.</p>
              )}
              {quote.closeRouteRequiresResolution && (
                <p className="mt-2 text-xs text-secondary">
                  Resolving exact full-close bound... preview values may adjust before execution.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleDeleverage}
                isLoading={deleverageFlowLoading || quote.isLoading}
                disabled={
                  route == null ||
                  hasInvalidPositionData ||
                  targetNeedsLeverage ||
                  quote.error !== null ||
                  quote.closeRouteRequiresResolution ||
                  exceedsMaxWithdraw ||
                  withdrawCollateralAmount <= 0n ||
                  projection.flashLoanAmountForTx <= 0n ||
                  projectedOverLimit
                }
                variant="primary"
                className="min-w-32"
              >
                {effectiveTargetLtvBps === 0n ? 'Unwind' : 'Decrease LTV'}
              </ExecuteTransactionButton>
            </div>

            {shouldShowProjectedRisk && projectedOverLimit && (
              <LTVWarning
                maxLTV={lltv}
                currentLTV={displayProjectedLTV}
                type="error"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
