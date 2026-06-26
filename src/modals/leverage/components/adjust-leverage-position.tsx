import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { useConnection } from 'wagmi';
import Input from '@/components/Input/Input';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { getLeverageFee } from '@/config/fees';
import { SlippageInlineEditor } from '@/features/swap/components/SlippageInlineEditor';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '@/features/swap/constants';
import { formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import {
  BPS_SCALE,
  clampMultiplierBps,
  clampTargetLtvBps,
  computeDebtAdjustmentForTargetLtv,
  computeDeleverageProjectedPosition,
  computeLeverageProjectedPosition,
  computeMaxMultiplierBpsForTargetLtv,
  formatTokenAmountPreview,
  ltvWadToBps,
  multiplierBpsFromTargetLtv,
  parseUnsignedBigInt,
  targetLtvBpsFromMultiplier,
  WAD_TO_BPS_SCALE,
  withSlippageInverseCeil,
} from '@/hooks/leverage/math';
import { LEVERAGE_MIN_MULTIPLIER_BPS } from '@/hooks/leverage/types';
import { useDeleverageQuote } from '@/hooks/useDeleverageQuote';
import { useDeleverageTransaction } from '@/hooks/useDeleverageTransaction';
import { useLeverageQuote } from '@/hooks/useLeverageQuote';
import { useLeverageTransaction } from '@/hooks/useLeverageTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import type { LeverageRoute } from '@/hooks/leverage/types';
import type { Market, MarketPosition } from '@/utils/types';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import { PreviewSectionHeader } from '@/modals/borrow/components/preview-section-header';
import {
  computeLtv,
  computeRequiredCollateralAssets,
  formatLtvPercent,
  getCollateralValueInLoan,
  LTV_WAD,
} from '@/modals/borrow/components/helpers';

type AdjustLeveragePositionProps = {
  market: Market;
  route: LeverageRoute | null;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

type AdjustmentAction = 'leverage' | 'deleverage' | 'none';

const LEVERAGE_SAFE_LTV_BUFFER_BPS = 100n;
const LOOP_COLLATERAL_OUTPUT_BUFFER_BPS = 1n;
const TARGET_INPUT_DEBOUNCE_MS = 300;

function PreviewRow({ label, children }: { label: ReactNode; children: ReactNode }): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-right tabular-nums">{children}</span>
    </div>
  );
}

function PreviewTokenAmount({
  amount,
  address,
  chainId,
  symbol,
}: {
  amount: { compact: string; full: string };
  address: string;
  chainId: number;
  symbol: string;
}): ReactNode {
  return (
    <>
      <Tooltip content={<span className="text-xs">{amount.full}</span>}>
        <span className="cursor-help border-b border-dotted border-white/40">{amount.compact}</span>
      </Tooltip>
      <TokenIcon
        address={address}
        chainId={chainId}
        symbol={symbol}
        width={14}
        height={14}
      />
    </>
  );
}

const minBigInt = (a: bigint, b: bigint): bigint => (a < b ? a : b);

export function AdjustLeveragePosition({
  market,
  route,
  currentPosition,
  collateralTokenBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: AdjustLeveragePositionProps): ReactNode {
  const { address: account } = useConnection();
  const { usePermit2: usePermit2Setting, leverageUseTargetLtvInput: useTargetLtvInput, setLeverageUseTargetLtvInput } = useAppSettings();
  const [addedCapitalAmount, setAddedCapitalAmount] = useState<bigint>(0n);
  const [addedCapitalError, setAddedCapitalError] = useState<string | null>(null);
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
  const lltvBps = useMemo(() => ltvWadToBps(lltv), [lltv]);
  const maxTargetLtvBps = useMemo(() => (lltvBps > LEVERAGE_SAFE_LTV_BUFFER_BPS ? lltvBps - LEVERAGE_SAFE_LTV_BUFFER_BPS : 0n), [lltvBps]);
  const maxMultiplierBps = useMemo(() => computeMaxMultiplierBpsForTargetLtv(maxTargetLtvBps), [maxTargetLtvBps]);
  const currentLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: currentBorrowAssets,
        collateralAssets: currentCollateralAssets,
        oraclePrice,
      }),
    [currentBorrowAssets, currentCollateralAssets, oraclePrice],
  );
  const currentLtvBps = useMemo(() => clampTargetLtvBps(ltvWadToBps(currentLTV), maxTargetLtvBps), [currentLTV, maxTargetLtvBps]);
  const targetWasEdited = targetLtvBps !== null;
  const effectiveTargetLtvBps = targetLtvBps ?? currentLtvBps;
  const effectiveMultiplierBps = useMemo(
    () => multiplierBpsFromTargetLtv(effectiveTargetLtvBps, maxMultiplierBps),
    [effectiveTargetLtvBps, maxMultiplierBps],
  );
  const currentMultiplierBps = useMemo(
    () => multiplierBpsFromTargetLtv(currentLtvBps, maxMultiplierBps),
    [currentLtvBps, maxMultiplierBps],
  );
  const currentPositionSummary = `${(Number(currentMultiplierBps) / Number(BPS_SCALE)).toFixed(2)}x / ${formatLtvPercent(currentLTV)}% LTV`;
  const swapSlippageBps = useMemo(() => slippagePercentToBps(swapSlippagePercent), [swapSlippagePercent]);
  const isErc4626Route = route?.kind === 'erc4626';
  const isSwapRoute = route?.kind === 'swap';
  const hasAddedCapital = addedCapitalAmount > 0n;
  const hasUserIntent = targetWasEdited || hasAddedCapital;

  const baseCollateralAssets = currentCollateralAssets + addedCapitalAmount;
  const baseCollateralValueInLoan = useMemo(
    () => getCollateralValueInLoan(baseCollateralAssets, oraclePrice),
    [baseCollateralAssets, oraclePrice],
  );
  const positionCollateralValueFactorBps = useMemo(() => {
    const roundedSlippageBps = BigInt(Math.max(0, Math.ceil(swapSlippageBps)));
    const factorBps = BPS_SCALE - roundedSlippageBps - LOOP_COLLATERAL_OUTPUT_BUFFER_BPS;
    return factorBps > 0n ? factorBps : 0n;
  }, [swapSlippageBps]);
  const targetDebtAdjustment = useMemo(
    () =>
      computeDebtAdjustmentForTargetLtv({
        collateralValueFactorBps: positionCollateralValueFactorBps,
        currentBorrowAssets,
        currentCollateralValueInLoan: baseCollateralValueInLoan,
        targetLtv: effectiveTargetLtvBps * WAD_TO_BPS_SCALE,
      }),
    [baseCollateralValueInLoan, currentBorrowAssets, effectiveTargetLtvBps, positionCollateralValueFactorBps],
  );
  const action: AdjustmentAction = hasUserIntent
    ? targetDebtAdjustment.direction === 'increase'
      ? 'leverage'
      : targetDebtAdjustment.direction === 'decrease'
        ? 'deleverage'
        : 'none'
    : 'none';
  const addedCapitalBlocksDeleverage = action === 'deleverage' && addedCapitalAmount > 0n;
  const leverageDebtInputAmount = action === 'leverage' ? targetDebtAdjustment.amount : 0n;
  const leverageQuote = useLeverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    initialCapitalInputAmount: action === 'leverage' ? addedCapitalAmount : 0n,
    positionDebtInputAmount: action === 'leverage' ? leverageDebtInputAmount : undefined,
    inputMode: 'collateral',
    multiplierBps: effectiveMultiplierBps,
    loanTokenAddress: market.loanAsset.address,
    loanTokenDecimals: market.loanAsset.decimals,
    collateralTokenAddress: market.collateralAsset.address,
    collateralTokenDecimals: market.collateralAsset.decimals,
    userAddress: account as `0x${string}` | undefined,
    slippageBps: swapSlippageBps,
  });

  const collateralAssetPriceUsd = useMemo(() => {
    const totalCollateralAssets = parseUnsignedBigInt(market.state?.collateralAssets) ?? 0n;
    const totalCollateralAssetsUsd = market.state.collateralAssetsUsd;
    if (
      totalCollateralAssets <= 0n ||
      totalCollateralAssetsUsd == null ||
      !Number.isFinite(totalCollateralAssetsUsd) ||
      totalCollateralAssetsUsd <= 0
    ) {
      return null;
    }

    const totalCollateralToken = Number(formatUnits(totalCollateralAssets, market.collateralAsset.decimals));
    if (!Number.isFinite(totalCollateralToken) || totalCollateralToken <= 0) return null;

    const priceUsd = totalCollateralAssetsUsd / totalCollateralToken;
    return Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null;
  }, [market.state.collateralAssets, market.state.collateralAssetsUsd, market.collateralAsset.decimals]);
  const leverageTransferFee = useMemo<bigint>(() => {
    return getLeverageFee({
      amount: leverageQuote.totalCollateralTokenAmountAdded,
      assetPriceUsd: collateralAssetPriceUsd,
      assetDecimals: market.collateralAsset.decimals,
    });
  }, [leverageQuote.totalCollateralTokenAmountAdded, collateralAssetPriceUsd, market.collateralAsset.decimals]);
  const netAddedCollateral = useMemo<bigint>(() => {
    return leverageQuote.totalCollateralTokenAmountAdded - leverageTransferFee;
  }, [leverageQuote.totalCollateralTokenAmountAdded, leverageTransferFee]);
  const isLeverageFeeReady = useMemo(
    () => action === 'leverage' && leverageQuote.flashLoanAssetAmount > 0n && netAddedCollateral > 0n,
    [action, leverageQuote.flashLoanAssetAmount, netAddedCollateral],
  );
  const leverageAddedCollateralAssets = isLeverageFeeReady ? netAddedCollateral : 0n;
  const leverageAddedBorrowAssets = isLeverageFeeReady ? leverageQuote.flashLoanAssetAmount : 0n;
  const leverageProjection = useMemo(
    () =>
      computeLeverageProjectedPosition({
        currentCollateralAssets,
        currentBorrowAssets,
        addedCollateralAssets: leverageAddedCollateralAssets,
        addedBorrowAssets: leverageAddedBorrowAssets,
      }),
    [currentCollateralAssets, currentBorrowAssets, leverageAddedCollateralAssets, leverageAddedBorrowAssets],
  );
  const leverageProjectedLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: leverageProjection.projectedBorrowAssets,
        collateralAssets: leverageProjection.projectedCollateralAssets,
        oraclePrice,
      }),
    [leverageProjection.projectedBorrowAssets, leverageProjection.projectedCollateralAssets, oraclePrice],
  );

  const targetRepayAmount =
    action === 'deleverage'
      ? effectiveTargetLtvBps === 0n
        ? currentBorrowAssets
        : minBigInt(targetDebtAdjustment.amount, currentBorrowAssets)
      : 0n;
  const targetRepayAmountWithSlippage = withSlippageInverseCeil(targetRepayAmount, swapSlippageBps);
  const targetWithdrawCollateralAmount =
    action === 'deleverage'
      ? effectiveTargetLtvBps === 0n
        ? currentCollateralAssets
        : computeRequiredCollateralAssets({
            // WHY: this is only the seed for the quote. The risk card stays authoritative because
            // the live route quote can move after slippage and fees.
            borrowAssets: targetRepayAmountWithSlippage,
            oraclePrice,
            targetLtv: LTV_WAD,
          })
      : 0n;
  const withdrawCollateralAmount = minBigInt(targetWithdrawCollateralAmount, currentCollateralAssets);
  const deleverageQuote = useDeleverageQuote({
    chainId: market.morphoBlue.chain.id,
    route: action === 'deleverage' && !addedCapitalBlocksDeleverage ? route : null,
    withdrawCollateralAmount:
      action === 'deleverage' && !addedCapitalBlocksDeleverage && !hasInvalidPositionData ? withdrawCollateralAmount : 0n,
    currentBorrowAssets: action === 'deleverage' && !addedCapitalBlocksDeleverage ? currentBorrowAssets : 0n,
    currentBorrowShares: action === 'deleverage' && !addedCapitalBlocksDeleverage ? currentBorrowShares : 0n,
    loanTokenAddress: market.loanAsset.address,
    loanTokenDecimals: market.loanAsset.decimals,
    collateralTokenAddress: market.collateralAsset.address,
    collateralTokenDecimals: market.collateralAsset.decimals,
    userAddress: account as `0x${string}` | undefined,
    slippageBps: swapSlippageBps,
  });
  const closeRoutePendingResolution =
    action === 'deleverage' &&
    route?.kind === 'swap' &&
    deleverageQuote.closeRouteRequiresResolution &&
    deleverageQuote.canCurrentSellCloseDebt;
  const closeRouteAvailableForPreview = deleverageQuote.closeRouteAvailable || closeRoutePendingResolution;
  const closeBoundForPreview = closeRoutePendingResolution ? withdrawCollateralAmount : deleverageQuote.maxCollateralForDebtRepay;
  const deleverageProjection = useMemo(
    () =>
      computeDeleverageProjectedPosition({
        currentCollateralAssets,
        currentBorrowAssets,
        currentBorrowShares,
        withdrawCollateralAmount,
        repayAmount: deleverageQuote.repayAmount,
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
      deleverageQuote.repayAmount,
      closeBoundForPreview,
      closeRouteAvailableForPreview,
      route,
      swapSlippageBps,
    ],
  );
  const deleverageProjectedLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: deleverageProjection.projectedBorrowAssets,
        collateralAssets: deleverageProjection.projectedCollateralAssets,
        oraclePrice,
      }),
    [deleverageProjection.projectedBorrowAssets, deleverageProjection.projectedCollateralAssets, oraclePrice],
  );

  const projectedCollateralAssets =
    action === 'leverage'
      ? leverageProjection.projectedCollateralAssets
      : action === 'deleverage'
        ? deleverageProjection.projectedCollateralAssets
        : currentCollateralAssets;
  const projectedBorrowAssets =
    action === 'leverage'
      ? leverageProjection.projectedBorrowAssets
      : action === 'deleverage'
        ? deleverageProjection.projectedBorrowAssets
        : currentBorrowAssets;
  const projectedLTV = action === 'leverage' ? leverageProjectedLTV : action === 'deleverage' ? deleverageProjectedLTV : currentLTV;
  const hasProjectedChanges =
    action === 'leverage'
      ? isLeverageFeeReady
      : action === 'deleverage'
        ? withdrawCollateralAmount > 0n && !deleverageQuote.isLoading && deleverageQuote.error == null
        : false;
  const projectedOverLimit = projectedLTV >= lltv;
  const positionProjectedAboveTarget =
    action === 'leverage' &&
    isLeverageFeeReady &&
    targetWasEdited &&
    projectedLTV > effectiveTargetLtvBps * WAD_TO_BPS_SCALE + WAD_TO_BPS_SCALE;
  const marketLiquidity = parseUnsignedBigInt(market.state?.liquidityAssets) ?? 0n;
  const insufficientLiquidity = action === 'leverage' && leverageQuote.flashLoanAssetAmount > marketLiquidity;
  const leverageFeeReadinessError = useMemo(() => {
    if (action !== 'leverage' || leverageQuote.flashLoanAssetAmount <= 0n) return null;
    if (netAddedCollateral <= 0n) return 'Net collateral after fee must be positive.';
    return null;
  }, [action, leverageQuote.flashLoanAssetAmount, netAddedCollateral]);
  const {
    transaction: leverageTransaction,
    isLoadingPermit2,
    permit2Authorized,
    leveragePending,
    isBundlerAuthorizationReady,
    approveAndLeverage,
    signAndLeverage,
  } = useLeverageTransaction({
    market,
    route,
    initialCapitalInputAmount: addedCapitalAmount,
    initialCapitalCollateralTokenAmount: leverageQuote.initialCapitalCollateralTokenAmount,
    flashLegCollateralTokenAmount: leverageQuote.flashLegCollateralTokenAmount,
    flashLoanAssetAmount: leverageQuote.flashLoanAssetAmount,
    totalCollateralTokenAmountAdded: leverageQuote.totalCollateralTokenAmountAdded,
    collateralAssetPriceUsd,
    swapPriceRoute: leverageQuote.swapPriceRoute,
    useLoanAssetInput: false,
    slippageBps: swapSlippageBps,
    onSuccess: () => {
      setAddedCapitalAmount(0n);
      setAddedCapitalError(null);
      setTargetLtvBps(null);
      onSuccess?.();
    },
  });
  const {
    transaction: deleverageTransaction,
    isLoading: deleverageFlowLoading,
    authorizeAndDeleverage,
    executionError,
    clearExecutionError,
  } = useDeleverageTransaction({
    market,
    route,
    withdrawCollateralAmount,
    maxWithdrawCollateralAmount: deleverageProjection.maxWithdrawCollateral,
    flashLoanAmount: deleverageProjection.flashLoanAmountForTx,
    repayBySharesAmount: deleverageProjection.repayBySharesAmount,
    useCloseRoute: deleverageProjection.usesCloseRoute,
    autoWithdrawCollateralAmount: deleverageProjection.autoWithdrawCollateralAmount,
    maxCollateralForDebtRepay: deleverageQuote.maxCollateralForDebtRepay,
    swapSellPriceRoute: deleverageQuote.swapSellPriceRoute,
    slippageBps: swapSlippageBps,
    onSuccess: () => {
      setAddedCapitalAmount(0n);
      setAddedCapitalError(null);
      setTargetLtvBps(null);
      onSuccess?.();
    },
  });
  const visibleTransaction = action === 'deleverage' ? deleverageTransaction : leverageTransaction;

  const handleTargetInputModeChange = useCallback(
    (nextUseTargetLtvInput: boolean) => {
      setLeverageUseTargetLtvInput(nextUseTargetLtvInput);
      setTargetLtvBps(effectiveTargetLtvBps);
    },
    [effectiveTargetLtvBps, setLeverageUseTargetLtvInput],
  );
  const handleMultiplierChange = useCallback(
    (nextMultiplierBps: bigint) => {
      const clampedMultiplier = clampMultiplierBps(nextMultiplierBps, maxMultiplierBps);
      setTargetLtvBps(clampTargetLtvBps(targetLtvBpsFromMultiplier(clampedMultiplier), maxTargetLtvBps));
    },
    [maxMultiplierBps, maxTargetLtvBps],
  );
  const handleTargetLtvChange = useCallback(
    (nextTargetLtvBps: bigint) => setTargetLtvBps(clampTargetLtvBps(nextTargetLtvBps, maxTargetLtvBps)),
    [maxTargetLtvBps],
  );
  const setTargetShortcut = useCallback(
    (nextTargetLtvBps: bigint) => {
      clearExecutionError();
      setTargetLtvBps(clampTargetLtvBps(nextTargetLtvBps, maxTargetLtvBps));
    },
    [clearExecutionError, maxTargetLtvBps],
  );
  const clearTargetInput = useCallback(() => {
    clearExecutionError();
    setTargetLtvBps(null);
  }, [clearExecutionError]);
  const closePosition = useCallback(() => {
    clearExecutionError();
    setAddedCapitalAmount(0n);
    setAddedCapitalError(null);
    setTargetLtvBps(0n);
  }, [clearExecutionError]);
  const targetShortcuts = useMemo(
    () => [
      { label: 'Current', onClick: clearTargetInput },
      { label: 'Max', onClick: () => setTargetShortcut(maxTargetLtvBps) },
      { label: 'Close', onClick: closePosition },
    ],
    [clearTargetInput, closePosition, maxTargetLtvBps, setTargetShortcut],
  );
  const handleSlippageChange = useCallback(
    (nextSlippagePercent: number) => {
      clearExecutionError();
      setSwapSlippagePercent(nextSlippagePercent);
    },
    [clearExecutionError],
  );
  const handleSubmit = useCallback(() => {
    if (action === 'leverage') {
      if (!isLeverageFeeReady) return;
      if (usePermit2Setting && permit2Authorized) {
        void signAndLeverage();
        return;
      }
      void approveAndLeverage();
      return;
    }

    if (action === 'deleverage') {
      if (
        hasInvalidPositionData ||
        addedCapitalBlocksDeleverage ||
        deleverageQuote.closeRouteRequiresResolution ||
        withdrawCollateralAmount > deleverageProjection.maxWithdrawCollateral
      ) {
        return;
      }
      void authorizeAndDeleverage();
    }
  }, [
    action,
    isLeverageFeeReady,
    usePermit2Setting,
    permit2Authorized,
    signAndLeverage,
    approveAndLeverage,
    hasInvalidPositionData,
    addedCapitalBlocksDeleverage,
    deleverageQuote.closeRouteRequiresResolution,
    withdrawCollateralAmount,
    deleverageProjection.maxWithdrawCollateral,
    authorizeAndDeleverage,
  ]);

  const leverageFeePreview = useMemo(() => {
    if (!isLeverageFeeReady) return null;
    return formatTokenAmountPreview(leverageTransferFee, market.collateralAsset.decimals);
  }, [isLeverageFeeReady, leverageTransferFee, market.collateralAsset.decimals]);
  const flashBorrowPreview = useMemo(
    () => formatTokenAmountPreview(leverageQuote.flashLoanAssetAmount, market.loanAsset.decimals),
    [leverageQuote.flashLoanAssetAmount, market.loanAsset.decimals],
  );
  const collateralAddedPreview = useMemo(
    () => formatTokenAmountPreview(leverageQuote.totalCollateralTokenAmountAdded, market.collateralAsset.decimals),
    [leverageQuote.totalCollateralTokenAmountAdded, market.collateralAsset.decimals],
  );
  const collateralUnwoundPreview = useMemo(
    () => formatTokenAmountPreview(withdrawCollateralAmount, market.collateralAsset.decimals),
    [withdrawCollateralAmount, market.collateralAsset.decimals],
  );
  const debtRepaidPreview = useMemo(
    () => formatTokenAmountPreview(deleverageProjection.previewDebtRepaid, market.loanAsset.decimals),
    [deleverageProjection.previewDebtRepaid, market.loanAsset.decimals],
  );
  const deleverageFlashBorrowPreview = useMemo(
    () => formatTokenAmountPreview(deleverageProjection.flashLoanAmountForTx, market.loanAsset.decimals),
    [deleverageProjection.flashLoanAmountForTx, market.loanAsset.decimals],
  );
  const swapRatePreviewText = useMemo(() => {
    const priceRoute = action === 'leverage' ? leverageQuote.swapPriceRoute : deleverageQuote.swapSellPriceRoute;
    if (!isSwapRoute || !priceRoute) return null;

    try {
      const baseAmount = BigInt(action === 'leverage' ? priceRoute.destAmount : priceRoute.srcAmount);
      const quoteAmount = BigInt(action === 'leverage' ? priceRoute.srcAmount : priceRoute.destAmount);
      return formatSwapRatePreview({
        baseAmount,
        baseTokenDecimals: market.collateralAsset.decimals,
        baseTokenSymbol: market.collateralAsset.symbol,
        quoteAmount,
        quoteTokenDecimals: market.loanAsset.decimals,
        quoteTokenSymbol: market.loanAsset.symbol,
      });
    } catch {
      return null;
    }
  }, [
    action,
    isSwapRoute,
    leverageQuote.swapPriceRoute,
    deleverageQuote.swapSellPriceRoute,
    market.collateralAsset.decimals,
    market.collateralAsset.symbol,
    market.loanAsset.decimals,
    market.loanAsset.symbol,
  ]);

  const previewLtvAction: AdjustmentAction = hasProjectedChanges
    ? projectedLTV > currentLTV
      ? 'leverage'
      : projectedLTV < currentLTV
        ? 'deleverage'
        : 'none'
    : 'none';
  const previewTitleAction = previewLtvAction === 'none' ? action : previewLtvAction;
  const previewTitle =
    previewTitleAction === 'deleverage'
      ? 'Deleverage Preview'
      : previewTitleAction === 'leverage'
        ? 'Leverage Preview'
        : 'Position Preview';
  const submitLabel = action === 'deleverage' && effectiveTargetLtvBps === 0n ? 'Close Position' : 'Adjust Leverage';
  const submitDisabled =
    route == null ||
    hasInvalidPositionData ||
    action === 'none' ||
    addedCapitalError !== null ||
    projectedOverLimit ||
    (action === 'leverage' &&
      (leverageQuote.error !== null ||
        !isBundlerAuthorizationReady ||
        !isLeverageFeeReady ||
        leverageQuote.flashLoanAssetAmount <= 0n ||
        positionProjectedAboveTarget ||
        insufficientLiquidity)) ||
    (action === 'deleverage' &&
      (addedCapitalBlocksDeleverage ||
        deleverageQuote.error !== null ||
        deleverageQuote.closeRouteRequiresResolution ||
        withdrawCollateralAmount <= 0n ||
        deleverageProjection.flashLoanAmountForTx <= 0n ||
        withdrawCollateralAmount > deleverageProjection.maxWithdrawCollateral));
  const isDeleverageCloseRouteResolving = action === 'deleverage' && deleverageQuote.closeRouteRequiresResolution;
  const shouldShowTransactionPreview =
    action !== 'none' ||
    hasInvalidPositionData ||
    addedCapitalBlocksDeleverage ||
    leverageQuote.error != null ||
    deleverageQuote.error != null ||
    executionError != null ||
    leverageFeeReadinessError != null ||
    positionProjectedAboveTarget ||
    insufficientLiquidity ||
    isDeleverageCloseRouteResolving;

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!visibleTransaction?.isModalVisible && (
        <div className="flex flex-col">
          <PreviewSectionHeader
            title={previewTitle}
            onRefresh={onSuccess}
            isRefreshing={isRefreshing}
          />
          <BorrowPositionRiskCard
            market={market}
            oraclePrice={oraclePrice}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            projectedCollateral={projectedCollateralAssets}
            projectedBorrow={projectedBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={projectedLTV}
            lltv={lltv}
            hasChanges={hasProjectedChanges}
            useCompactAmountDisplay
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">Add Capital</p>
              </div>
              <Input
                decimals={market.collateralAsset.decimals}
                max={collateralTokenBalance}
                setValue={setAddedCapitalAmount}
                setError={setAddedCapitalError}
                exceedMaxErrMessage="Insufficient Balance"
                value={addedCapitalAmount}
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
              <div className="mt-1 flex items-start gap-3 text-xs">
                {addedCapitalError && <p className="text-red-500">{addedCapitalError}</p>}
                <span className="ml-auto text-right text-secondary">
                  Balance: {formatBalance(collateralTokenBalance ?? 0n, market.collateralAsset.decimals)} {market.collateralAsset.symbol}
                </span>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">
                  {useTargetLtvInput ? 'Target LTV' : 'Target Multiplier'}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="text-xs text-secondary">Use LTV</div>
                  <IconSwitch
                    size="sm"
                    selected={useTargetLtvInput}
                    onChange={handleTargetInputModeChange}
                    thumbIcon={null}
                    classNames={{
                      wrapper: 'mr-0 h-4 w-9',
                      thumb: 'h-3 w-3',
                    }}
                  />
                </div>
              </div>
              {useTargetLtvInput ? (
                <Input
                  decimals={2}
                  setValue={handleTargetLtvChange}
                  value={effectiveTargetLtvBps}
                  inputClassName="h-10 rounded bg-surface px-3 py-2 pr-10 text-base font-medium tabular-nums"
                  endAdornment={<span className="text-xs text-secondary">%</span>}
                  debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
                  onEmpty={clearTargetInput}
                />
              ) : (
                <Input
                  decimals={4}
                  setValue={handleMultiplierChange}
                  value={effectiveMultiplierBps > 0n ? effectiveMultiplierBps : LEVERAGE_MIN_MULTIPLIER_BPS}
                  inputClassName="h-10 rounded bg-surface px-3 py-2 pr-10 text-base font-medium tabular-nums"
                  endAdornment={<span className="text-xs text-secondary">x</span>}
                  debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
                  onEmpty={clearTargetInput}
                />
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {targetShortcuts.map((shortcut) => (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={shortcut.onClick}
                      className="rounded border border-white/10 bg-surface px-2 py-1 text-xs text-secondary transition hover:border-white/20 hover:text-primary"
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <p className="text-right text-xs text-secondary">{currentPositionSummary}</p>
              </div>
            </div>

            {shouldShowTransactionPreview && (
              <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-secondary">Transaction Preview</p>
                <div className="space-y-1 text-xs">
                  {action === 'leverage' && (
                    <>
                      <PreviewRow label="Borrow More">
                        <PreviewTokenAmount
                          amount={flashBorrowPreview}
                          address={market.loanAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.loanAsset.symbol}
                        />
                      </PreviewRow>
                      <PreviewRow label={isSwapRoute ? 'Collateral From Loop (Min.)' : 'Collateral Added (Min.)'}>
                        <PreviewTokenAmount
                          amount={collateralAddedPreview}
                          address={market.collateralAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.collateralAsset.symbol}
                        />
                      </PreviewRow>
                      {leverageFeePreview != null && (
                        <PreviewRow label="Fee">
                          <PreviewTokenAmount
                            amount={leverageFeePreview}
                            address={market.collateralAsset.address}
                            chainId={market.morphoBlue.chain.id}
                            symbol={market.collateralAsset.symbol}
                          />
                        </PreviewRow>
                      )}
                    </>
                  )}
                  {action === 'deleverage' && (
                    <>
                      <PreviewRow label={isSwapRoute ? 'Collateral Sold' : 'Collateral Unwound'}>
                        <PreviewTokenAmount
                          amount={collateralUnwoundPreview}
                          address={market.collateralAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.collateralAsset.symbol}
                        />
                      </PreviewRow>
                      <PreviewRow label="Debt Repaid">
                        <PreviewTokenAmount
                          amount={debtRepaidPreview}
                          address={market.loanAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.loanAsset.symbol}
                        />
                      </PreviewRow>
                      <PreviewRow label="Flash Borrow">
                        <PreviewTokenAmount
                          amount={deleverageFlashBorrowPreview}
                          address={market.loanAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.loanAsset.symbol}
                        />
                      </PreviewRow>
                    </>
                  )}
                  {swapRatePreviewText != null && (
                    <PreviewRow label="Swap Quote">
                      <span>{swapRatePreviewText}</span>
                    </PreviewRow>
                  )}
                  {(action === 'leverage' || action === 'deleverage') && (isSwapRoute || isErc4626Route) && (
                    <PreviewRow label="Max Slippage">
                      <SlippageInlineEditor
                        value={swapSlippagePercent}
                        onChange={handleSlippageChange}
                      />
                    </PreviewRow>
                  )}
                </div>
                {hasInvalidPositionData && (
                  <p className="mt-2 text-xs text-red-500">Unable to read valid position data. Refresh balances and try again.</p>
                )}
                {addedCapitalBlocksDeleverage && (
                  <p className="mt-2 text-xs text-red-500">
                    Added capital only applies when the target borrows more. Clear it to preview an unwind.
                  </p>
                )}
                {action === 'leverage' && leverageQuote.error && <p className="mt-2 text-xs text-red-500">{leverageQuote.error}</p>}
                {action === 'deleverage' && deleverageQuote.error && <p className="mt-2 text-xs text-red-500">{deleverageQuote.error}</p>}
                {executionError && <p className="mt-2 text-xs text-red-500">{executionError}</p>}
                {!leverageQuote.error && leverageFeeReadinessError && (
                  <p className="mt-2 text-xs text-red-500">{leverageFeeReadinessError}</p>
                )}
                {positionProjectedAboveTarget && (
                  <p className="mt-2 text-xs text-red-500">Projected LTV is above target after route quote. Lower the target or refresh.</p>
                )}
                {insufficientLiquidity && (
                  <p className="mt-2 text-xs text-red-500">
                    Flash loan borrow exceeds market liquidity ({formatBalance(marketLiquidity, market.loanAsset.decimals)}{' '}
                    {market.loanAsset.symbol} available).
                  </p>
                )}
                {action === 'deleverage' && deleverageQuote.closeRouteRequiresResolution && (
                  <p className="mt-2 text-xs text-secondary">Resolving exact close bound. Preview may adjust before execution.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleSubmit}
                isLoading={
                  action === 'leverage'
                    ? isLoadingPermit2 || leveragePending || leverageQuote.isLoading
                    : action === 'deleverage'
                      ? deleverageFlowLoading || deleverageQuote.isLoading
                      : false
                }
                disabled={submitDisabled}
                variant="primary"
                className="min-w-32"
              >
                {submitLabel}
              </ExecuteTransactionButton>
            </div>

            {hasProjectedChanges && projectedOverLimit && (
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
