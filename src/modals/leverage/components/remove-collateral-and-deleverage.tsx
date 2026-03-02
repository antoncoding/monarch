import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnection } from 'wagmi';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Tooltip } from '@/components/ui/tooltip';
import { IconSwitch } from '@/components/ui/icon-switch';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { SlippageInlineEditor } from '@/features/swap/components/SlippageInlineEditor';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '@/features/swap/constants';
import { formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import { computeDeleverageProjectedPosition, formatTokenAmountPreview, parseUnsignedBigInt } from '@/hooks/leverage/math';
import { useDeleverageQuote } from '@/hooks/useDeleverageQuote';
import { useDeleverageTransaction } from '@/hooks/useDeleverageTransaction';
import type { Market, MarketPosition } from '@/utils/types';
import type { LeverageRoute } from '@/hooks/leverage/types';
import {
  clampEditablePercent,
  clampTargetLtv,
  computeLtv,
  formatEditableLtvPercent,
  formatLtvPercent,
  getCollateralValueInLoan,
  getLTVColor,
  ltvWadToPercent,
  normalizeEditablePercentInput,
  percentToLtvWad,
} from '@/modals/borrow/components/helpers';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';

type RemoveCollateralAndDeleverageProps = {
  market: Market;
  route: LeverageRoute | null;
  currentPosition: MarketPosition | null;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

const TARGET_LTV_SEARCH_STEPS = 40n;

const absDiffBigInt = (a: bigint, b: bigint): bigint => (a >= b ? a - b : b - a);

const estimateRepayAmountFromWithdraw = ({
  withdrawCollateralAmount,
  currentBorrowAssets,
  referenceWithdrawAmount,
  referenceRepayAmount,
  oraclePrice,
}: {
  withdrawCollateralAmount: bigint;
  currentBorrowAssets: bigint;
  referenceWithdrawAmount: bigint;
  referenceRepayAmount: bigint;
  oraclePrice: bigint;
}): bigint => {
  if (withdrawCollateralAmount <= 0n || currentBorrowAssets <= 0n) return 0n;
  if (referenceWithdrawAmount > 0n && referenceRepayAmount > 0n) {
    const estimatedRepayFromRatio = (withdrawCollateralAmount * referenceRepayAmount) / referenceWithdrawAmount;
    return estimatedRepayFromRatio > currentBorrowAssets ? currentBorrowAssets : estimatedRepayFromRatio;
  }
  const estimatedRepayFromOracle = getCollateralValueInLoan(withdrawCollateralAmount, oraclePrice);
  return estimatedRepayFromOracle > currentBorrowAssets ? currentBorrowAssets : estimatedRepayFromOracle;
};

const estimateWithdrawAmountForTargetLtv = ({
  targetLtv,
  currentCollateralAssets,
  currentBorrowAssets,
  currentBorrowShares,
  maxWithdrawCollateral,
  referenceWithdrawAmount,
  referenceRepayAmount,
  maxCollateralForDebtRepay,
  closeRouteAvailable,
  closeBoundIsInputCap,
  slippageBps,
  oraclePrice,
}: {
  targetLtv: bigint;
  currentCollateralAssets: bigint;
  currentBorrowAssets: bigint;
  currentBorrowShares: bigint;
  maxWithdrawCollateral: bigint;
  referenceWithdrawAmount: bigint;
  referenceRepayAmount: bigint;
  maxCollateralForDebtRepay: bigint;
  closeRouteAvailable: boolean;
  closeBoundIsInputCap: boolean;
  slippageBps: number;
  oraclePrice: bigint;
}): bigint => {
  if (targetLtv <= 0n || maxWithdrawCollateral <= 0n || currentCollateralAssets <= 0n) return 0n;

  const evaluateProjectedLtv = (candidateWithdrawAmount: bigint): bigint => {
    const estimatedRepayAmount = estimateRepayAmountFromWithdraw({
      withdrawCollateralAmount: candidateWithdrawAmount,
      currentBorrowAssets,
      referenceWithdrawAmount,
      referenceRepayAmount,
      oraclePrice,
    });
    const projectedPosition = computeDeleverageProjectedPosition({
      currentCollateralAssets,
      currentBorrowAssets,
      currentBorrowShares,
      withdrawCollateralAmount: candidateWithdrawAmount,
      repayAmount: estimatedRepayAmount,
      maxCollateralForDebtRepay,
      closeRouteAvailable,
      closeBoundIsInputCap,
      slippageBps,
    });

    return computeLtv({
      borrowAssets: projectedPosition.projectedBorrowAssets,
      collateralAssets: projectedPosition.projectedCollateralAssets,
      oraclePrice,
    });
  };

  let bestCandidate = 0n;
  let bestDistance = absDiffBigInt(evaluateProjectedLtv(0n), targetLtv);

  for (let step = 1n; step <= TARGET_LTV_SEARCH_STEPS; step += 1n) {
    const candidateWithdrawAmount = (maxWithdrawCollateral * step) / TARGET_LTV_SEARCH_STEPS;
    const projectedLtv = evaluateProjectedLtv(candidateWithdrawAmount);
    const distance = absDiffBigInt(projectedLtv, targetLtv);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidateWithdrawAmount;
    }
  }

  return bestCandidate;
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
  const [withdrawCollateralAmount, setWithdrawCollateralAmount] = useState<bigint>(0n);
  const [useTargetLtvInput, setUseTargetLtvInput] = useState(true);
  const [targetLtvInput, setTargetLtvInput] = useState<string>('0');
  const [isEditingTargetLtvInput, setIsEditingTargetLtvInput] = useState(false);
  const [swapSlippagePercent, setSwapSlippagePercent] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);
  const [withdrawInputError, setWithdrawInputError] = useState<string | null>(null);

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
  const maxTargetLtvPercent = useMemo(() => Math.min(100, ltvWadToPercent(clampTargetLtv(lltv, lltv))), [lltv]);
  const quoteWithdrawCollateralAmount = hasInvalidPositionData ? 0n : withdrawCollateralAmount;
  const swapSlippageBps = useMemo(() => slippagePercentToBps(swapSlippagePercent), [swapSlippagePercent]);

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

  const currentLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: currentBorrowAssets,
        collateralAssets: currentCollateralAssets,
        oraclePrice,
      }),
    [currentBorrowAssets, currentCollateralAssets, oraclePrice],
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
    setWithdrawCollateralAmount(0n);
    setWithdrawInputError(null);
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
      withdrawInputError ||
      quote.closeRouteRequiresResolution ||
      withdrawCollateralAmount > projection.maxWithdrawCollateral
    ) {
      return;
    }
    void authorizeAndDeleverage();
  }, [
    hasInvalidPositionData,
    withdrawInputError,
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
  const ltvInputClassName =
    'h-10 w-full rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums focus:border-primary focus:outline-none';

  const handleWithdrawAmountChange = useCallback((nextWithdrawAmount: bigint) => {
    clearExecutionError();
    setWithdrawCollateralAmount(nextWithdrawAmount);
  }, [clearExecutionError]);

  const handleSwapSlippageChange = useCallback(
    (nextSlippagePercent: number) => {
      clearExecutionError();
      setSwapSlippagePercent(nextSlippagePercent);
    },
    [clearExecutionError],
  );

  const handleTargetLtvInputChange = useCallback(
    (value: string) => {
      clearExecutionError();
      const normalizedInput = normalizeEditablePercentInput(value);
      if (normalizedInput == null) return;
      setTargetLtvInput(normalizedInput);
      if (normalizedInput === '') return;
      const parsedPercent = Number.parseFloat(normalizedInput);
      if (!Number.isFinite(parsedPercent)) return;
      const clampedPercent = clampEditablePercent(parsedPercent, maxTargetLtvPercent);
      const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
      if (clampedTargetLtv <= 0n) {
        setWithdrawCollateralAmount(0n);
        setWithdrawInputError(null);
        return;
      }
      const nextWithdrawAmount = estimateWithdrawAmountForTargetLtv({
        targetLtv: clampedTargetLtv,
        currentCollateralAssets,
        currentBorrowAssets,
        currentBorrowShares,
        maxWithdrawCollateral: projection.maxWithdrawCollateral,
        referenceWithdrawAmount: withdrawCollateralAmount,
        referenceRepayAmount: quote.repayAmount,
        maxCollateralForDebtRepay: quote.maxCollateralForDebtRepay,
        closeRouteAvailable: quote.closeRouteAvailable,
        closeBoundIsInputCap: route?.kind !== 'swap',
        slippageBps: swapSlippageBps,
        oraclePrice,
      });
      setWithdrawCollateralAmount(nextWithdrawAmount);
      setWithdrawInputError(nextWithdrawAmount > projection.maxWithdrawCollateral ? 'Exceeds deleverageable collateral' : null);
    },
    [
      maxTargetLtvPercent,
      lltv,
      currentCollateralAssets,
      currentBorrowAssets,
      currentBorrowShares,
      projection.maxWithdrawCollateral,
      withdrawCollateralAmount,
      quote.repayAmount,
      quote.maxCollateralForDebtRepay,
      quote.closeRouteAvailable,
      swapSlippageBps,
      route,
      oraclePrice,
      clearExecutionError,
    ],
  );

  const handleTargetLtvInputBlur = useCallback(() => {
    setIsEditingTargetLtvInput(false);
    const parsedPercent = Number.parseFloat(targetLtvInput.replace(',', '.'));
    if (!Number.isFinite(parsedPercent)) {
      setTargetLtvInput(formatEditableLtvPercent(ltvWadToPercent(displayProjectedLTV), maxTargetLtvPercent));
      return;
    }
    const clampedPercent = clampEditablePercent(parsedPercent, maxTargetLtvPercent);
    const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
    setTargetLtvInput(formatEditableLtvPercent(ltvWadToPercent(clampedTargetLtv), maxTargetLtvPercent));
  }, [targetLtvInput, displayProjectedLTV, maxTargetLtvPercent, lltv]);

  const handleInputModeChange = useCallback((nextUseTargetLtvInput: boolean) => {
    clearExecutionError();
    setUseTargetLtvInput(nextUseTargetLtvInput);
    setWithdrawInputError(null);
  }, [clearExecutionError]);

  useEffect(() => {
    if (isEditingTargetLtvInput) return;
    setTargetLtvInput(formatEditableLtvPercent(ltvWadToPercent(displayProjectedLTV), maxTargetLtvPercent));
  }, [isEditingTargetLtvInput, displayProjectedLTV, maxTargetLtvPercent]);
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
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Deleverage Preview</p>
          <BorrowPositionRiskCard
            market={market}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={displayProjectedLTV}
            lltv={lltv}
            onRefresh={onSuccess}
            isRefreshing={isRefreshing}
            hasChanges={shouldShowProjectedRisk}
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
                  {useTargetLtvInput ? 'Target LTV' : `Collateral To Unwind ${market.collateralAsset.symbol}`}
                </p>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-secondary">Use LTV</div>
                  <IconSwitch
                    size="sm"
                    selected={useTargetLtvInput}
                    onChange={handleInputModeChange}
                    thumbIcon={null}
                    classNames={{
                      wrapper: 'mr-0 h-4 w-9',
                      thumb: 'h-3 w-3',
                    }}
                  />
                </div>
              </div>
              {useTargetLtvInput ? (
                <div className="relative min-w-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    min={0}
                    max={maxTargetLtvPercent}
                    step={0.01}
                    value={targetLtvInput}
                    onFocus={() => setIsEditingTargetLtvInput(true)}
                    onChange={(event) => handleTargetLtvInputChange(event.target.value)}
                    onBlur={handleTargetLtvInputBlur}
                    className={ltvInputClassName}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">%</span>
                </div>
              ) : (
                <>
                  <Input
                    decimals={market.collateralAsset.decimals}
                    max={projection.maxWithdrawCollateral}
                    allowExceedMax={true}
                    setValue={handleWithdrawAmountChange}
                    setError={setWithdrawInputError}
                    exceedMaxErrMessage="Exceeds deleverageable collateral"
                    value={withdrawCollateralAmount}
                    inputClassName="h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums"
                    endAdornment={
                      <TokenIcon
                        address={market.collateralAsset.address}
                        chainId={market.morphoBlue.chain.id}
                        symbol={market.collateralAsset.symbol}
                        width={16}
                        height={16}
                      />
                    }
                  />
                  {withdrawInputError && <p className="mt-1 text-right text-xs text-red-500">{withdrawInputError}</p>}
                  {!withdrawInputError && exceedsMaxWithdraw && (
                    <p className="mt-1 text-right text-xs text-red-500">Exceeds deleverageable collateral</p>
                  )}
                </>
              )}
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
                  withdrawInputError !== null ||
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
                Deleverage
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
