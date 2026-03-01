import { useCallback, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Tooltip } from '@/components/ui/tooltip';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { DEFAULT_SLIPPAGE_PERCENT } from '@/features/swap/constants';
import { formatSlippagePercent, formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import { computeDeleverageProjectedPosition, formatTokenAmountPreview } from '@/hooks/leverage/math';
import { useDeleverageQuote } from '@/hooks/useDeleverageQuote';
import { useDeleverageTransaction } from '@/hooks/useDeleverageTransaction';
import type { Market, MarketPosition } from '@/utils/types';
import type { LeverageRoute } from '@/hooks/leverage/types';
import { computeLtv, formatLtvPercent, getLTVColor } from '@/modals/borrow/components/helpers';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';

type RemoveCollateralAndDeleverageProps = {
  market: Market;
  route: LeverageRoute | null;
  currentPosition: MarketPosition | null;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

const UNSIGNED_DIGITS_REGEX = /^\d+$/;
const parseUnsignedBigInt = (value: unknown): bigint | null => {
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!UNSIGNED_DIGITS_REGEX.test(normalized)) return null;
    try {
      return BigInt(normalized);
    } catch {
      return null;
    }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  return null;
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
  const isErc4626Route = route?.kind === 'erc4626';
  const routeLabel = isSwapRoute ? 'Route: Swap (Bundler3 + Velora)' : isErc4626Route ? 'Route: Vault (ERC4626)' : 'Route: Unsupported';
  const [withdrawCollateralAmount, setWithdrawCollateralAmount] = useState<bigint>(0n);
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
      }),
    [
      currentCollateralAssets,
      currentBorrowAssets,
      currentBorrowShares,
      withdrawCollateralAmount,
      quote.repayAmount,
      closeBoundForPreview,
      closeRouteAvailableForPreview,
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
  const exceedsMaxWithdraw = withdrawCollateralAmount > projection.maxWithdrawCollateral;
  const projectedOverLimit = projectedLTV >= lltv;
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
  const swapSlippagePreviewText = `${formatSlippagePercent(DEFAULT_SLIPPAGE_PERCENT)}%`;

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Deleverage Preview</p>
          <p className="mb-2 text-xs text-secondary">{routeLabel}</p>
          <BorrowPositionRiskCard
            market={market}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={projectedLTV}
            lltv={lltv}
            onRefresh={onSuccess}
            isRefreshing={isRefreshing}
            hasChanges={hasChanges}
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
                Collateral To Unwind {market.collateralAsset.symbol}
              </p>
              <Input
                decimals={market.collateralAsset.decimals}
                max={projection.maxWithdrawCollateral}
                setValue={setWithdrawCollateralAmount}
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
                      <span>{swapSlippagePreviewText}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Projected LTV</span>
                  <span className={`tabular-nums ${getLTVColor(projectedLTV, lltv)}`}>{formatLtvPercent(projectedLTV)}%</span>
                </div>
              </div>
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
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

            {hasChanges && projectedOverLimit && (
              <LTVWarning
                maxLTV={lltv}
                currentLTV={projectedLTV}
                type="error"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
