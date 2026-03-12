import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi, formatUnits } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import { PreviewSectionHeader } from '@/modals/borrow/components/preview-section-header';
import { LTV_WAD, computeLtv } from '@/modals/borrow/components/helpers';
import { HelpTooltipIcon } from '@/components/shared/help-tooltip-icon';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { TooltipContent as SharedTooltipContent } from '@/components/shared/tooltip-content';
import Input from '@/components/Input/Input';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import {
  clampTargetLtvBps,
  clampMultiplierBps,
  computeMaxMultiplierBpsForTargetLtv,
  convertVaultSharesToUnderlyingAssets,
  computeLeverageProjectedPosition,
  formatTokenAmountPreview,
  ltvWadToBps,
  multiplierBpsFromTargetLtv,
  parseUnsignedBigInt,
  toScaledRatio,
  targetLtvBpsFromMultiplier,
} from '@/hooks/leverage/math';
import { LEVERAGE_DEFAULT_MULTIPLIER_BPS } from '@/hooks/leverage/types';
import { useMerklHoldIncentivesQuery } from '@/hooks/queries/useMerklHoldIncentivesQuery';
import { use4626VaultAPR } from '@/hooks/use4626VaultAPR';
import { useLeverageQuote } from '@/hooks/useLeverageQuote';
import { useLeverageTransaction } from '@/hooks/useLeverageTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { SlippageInlineEditor } from '@/features/swap/components/SlippageInlineEditor';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '@/features/swap/constants';
import { formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import { getLeverageFee } from '@/config/fees';
import { computeAssetUsdValue, formatUsdValueDisplay } from '@/utils/assetDisplay';
import { formatBalance } from '@/utils/balance';
import { previewMarketState } from '@/utils/morpho';
import { convertAprToApy, toApyFromDisplayRate, toDisplayRateFromApy } from '@/utils/rateMath';
import type { LeverageRoute } from '@/hooks/leverage/types';
import type { Market, MarketPosition } from '@/utils/types';

type AddCollateralAndLeverageProps = {
  market: Market;
  route: LeverageRoute | null;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

const LEVERAGE_SAFE_LTV_BUFFER_BPS = 100n; // keep a 1% buffer below liquidation LTV
const TARGET_INPUT_DEBOUNCE_MS = 300;
const INLINE_VALUE_TOOLTIP_CLASS_NAME = 'px-4 py-3 text-xs';

export function AddCollateralAndLeverage({
  market,
  route,
  currentPosition,
  collateralTokenBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: AddCollateralAndLeverageProps): JSX.Element {
  const { address: account } = useConnection();
  const {
    usePermit2: usePermit2Setting,
    isAprDisplay,
    showFullRewardAPY,
    leverageUseTargetLtvInput: useTargetLtvInput,
    setLeverageUseTargetLtvInput,
  } = useAppSettings();
  const lltv = useMemo(() => parseUnsignedBigInt(market.lltv) ?? 0n, [market.lltv]);
  const lltvBps = useMemo(() => ltvWadToBps(lltv), [lltv]);
  const maxTargetLtvBps = useMemo(() => (lltvBps > LEVERAGE_SAFE_LTV_BUFFER_BPS ? lltvBps - LEVERAGE_SAFE_LTV_BUFFER_BPS : 0n), [lltvBps]);
  const maxMultiplierBps = useMemo(() => computeMaxMultiplierBpsForTargetLtv(maxTargetLtvBps), [maxTargetLtvBps]);
  const defaultMultiplierBps = useMemo(() => clampMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS, maxMultiplierBps), [maxMultiplierBps]);
  const defaultTargetLtvIntentBps = useMemo(
    () => clampTargetLtvBps(targetLtvBpsFromMultiplier(defaultMultiplierBps), maxTargetLtvBps),
    [defaultMultiplierBps, maxTargetLtvBps],
  );

  const [initialCapitalInputAmount, setInitialCapitalInputAmount] = useState<bigint>(0n);
  const [initialCapitalInputError, setInitialCapitalInputError] = useState<string | null>(null);
  const [useLoanAssetInput, setUseLoanAssetInput] = useState(false);
  const [targetMultiplierBps, setTargetMultiplierBps] = useState<bigint>(defaultMultiplierBps);
  const [targetLtvIntentBps, setTargetLtvIntentBps] = useState<bigint>(defaultTargetLtvIntentBps);
  const [swapSlippagePercent, setSwapSlippagePercent] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);

  const multiplierBps = useMemo(() => clampMultiplierBps(targetMultiplierBps, maxMultiplierBps), [targetMultiplierBps, maxMultiplierBps]);
  const targetLtvBps = useMemo(
    () => clampTargetLtvBps(targetLtvBpsFromMultiplier(multiplierBps), maxTargetLtvBps),
    [multiplierBps, maxTargetLtvBps],
  );
  const swapSlippageBps = useMemo(() => slippagePercentToBps(swapSlippagePercent), [swapSlippagePercent]);
  const isErc4626Route = route?.kind === 'erc4626';
  const isSwapRoute = route?.kind === 'swap';
  const canUseLoanAssetInput = isErc4626Route || isSwapRoute;

  const { data: loanTokenBalance, refetch: refetchLoanTokenBalance } = useReadContract({
    address: market.loanAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account && useLoanAssetInput,
    },
  });

  useEffect(() => {
    // The initial-capital field flips between loan-asset units and collateral-token units.
    setInitialCapitalInputAmount(0n);
    setInitialCapitalInputError(null);
  }, [useLoanAssetInput]);

  useEffect(() => {
    if (canUseLoanAssetInput) return;
    setUseLoanAssetInput(false);
  }, [canUseLoanAssetInput]);

  useEffect(() => {
    const clampedMultiplier = clampMultiplierBps(targetMultiplierBps, maxMultiplierBps);
    if (clampedMultiplier !== targetMultiplierBps) {
      setTargetMultiplierBps(clampedMultiplier);
    }

    if (useTargetLtvInput) return;
    const derivedTargetLtvBps = clampTargetLtvBps(targetLtvBpsFromMultiplier(clampedMultiplier), maxTargetLtvBps);
    if (derivedTargetLtvBps !== targetLtvIntentBps) {
      setTargetLtvIntentBps(derivedTargetLtvBps);
    }
  }, [targetMultiplierBps, maxMultiplierBps, maxTargetLtvBps, useTargetLtvInput, targetLtvIntentBps]);

  const quote = useLeverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    initialCapitalInputAmount,
    inputMode: useLoanAssetInput ? 'loan' : 'collateral',
    multiplierBps,
    loanTokenAddress: market.loanAsset.address,
    loanTokenDecimals: market.loanAsset.decimals,
    collateralTokenAddress: market.collateralAsset.address,
    collateralTokenDecimals: market.collateralAsset.decimals,
    userAddress: account as `0x${string}` | undefined,
    slippageBps: swapSlippageBps,
  });

  const currentCollateralAssets = BigInt(currentPosition?.state.collateral ?? 0);
  const currentBorrowAssets = BigInt(currentPosition?.state.borrowAssets ?? 0);
  const hasQuoteChanges = quote.totalCollateralTokenAmountAdded > 0n && quote.flashLoanAssetAmount > 0n;
  const collateralAssetPriceUsd = useMemo(() => {
    const totalCollateralAssets = BigInt(market.state.collateralAssets);
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
  const leverageTransferFee = useMemo<bigint | null>(() => {
    if (collateralAssetPriceUsd == null) return null;
    return getLeverageFee({
      amount: quote.totalCollateralTokenAmountAdded,
      assetPriceUsd: collateralAssetPriceUsd,
      assetDecimals: market.collateralAsset.decimals,
    });
  }, [quote.totalCollateralTokenAmountAdded, collateralAssetPriceUsd, market.collateralAsset.decimals]);
  const netAddedCollateral = useMemo<bigint | null>(() => {
    if (leverageTransferFee == null) return null;
    return quote.totalCollateralTokenAmountAdded - leverageTransferFee;
  }, [quote.totalCollateralTokenAmountAdded, leverageTransferFee]);
  const isLeverageFeeReady = useMemo(
    () => hasQuoteChanges && leverageTransferFee != null && netAddedCollateral != null && netAddedCollateral > 0n,
    [hasQuoteChanges, leverageTransferFee, netAddedCollateral],
  );
  const leverageFeeReadinessError = useMemo(() => {
    if (!hasQuoteChanges) return null;
    if (collateralAssetPriceUsd == null) return 'Collateral price unavailable. Leverage preview and submit are disabled.';
    if (leverageTransferFee == null || netAddedCollateral == null) return 'Leverage fee unavailable. Please retry.';
    if (netAddedCollateral <= 0n) return 'Net collateral after fee must be positive.';
    return null;
  }, [hasQuoteChanges, collateralAssetPriceUsd, leverageTransferFee, netAddedCollateral]);
  const addedCollateralAssets = useMemo(
    () => (isLeverageFeeReady && netAddedCollateral != null ? netAddedCollateral : 0n),
    [isLeverageFeeReady, netAddedCollateral],
  );
  const addedBorrowAssets = useMemo(
    () => (isLeverageFeeReady ? quote.flashLoanAssetAmount : 0n),
    [isLeverageFeeReady, quote.flashLoanAssetAmount],
  );
  const { projectedCollateralAssets, projectedBorrowAssets } = useMemo(
    () =>
      computeLeverageProjectedPosition({
        currentCollateralAssets,
        currentBorrowAssets,
        addedCollateralAssets,
        addedBorrowAssets,
      }),
    [currentCollateralAssets, currentBorrowAssets, addedCollateralAssets, addedBorrowAssets],
  );
  const marketLiquidity = BigInt(market.state.liquidityAssets);
  const hasChanges = isLeverageFeeReady;
  const rateLabel = isAprDisplay ? 'APR' : 'APY';

  const vaultRateInsight = use4626VaultAPR({
    market,
    vaultAddress: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    projectedCollateralShares: projectedCollateralAssets,
    projectedBorrowAssets,
    enabled: isErc4626Route,
    lookbackDays: 3,
  });
  const merklHoldIncentives = useMerklHoldIncentivesQuery({
    chainId: market.morphoBlue.chain.id,
    collateralTokenAddress: market.collateralAsset.address,
  });

  const projectedLTV = useMemo(
    () =>
      computeLtv({
        borrowAssets: projectedBorrowAssets,
        collateralAssets: projectedCollateralAssets,
        oraclePrice,
      }),
    [projectedBorrowAssets, projectedCollateralAssets, oraclePrice],
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

  const syncInputFieldsFromMultiplier = useCallback(
    (nextMultiplierBps: bigint) => {
      const clampedMultiplier = clampMultiplierBps(nextMultiplierBps, maxMultiplierBps);
      const derivedTargetLtvBps = clampTargetLtvBps(targetLtvBpsFromMultiplier(clampedMultiplier), maxTargetLtvBps);
      setTargetMultiplierBps(clampedMultiplier);
      setTargetLtvIntentBps(derivedTargetLtvBps);
    },
    [maxMultiplierBps, maxTargetLtvBps],
  );

  const handleTransactionSuccess = useCallback(() => {
    // WHY: after a confirmed leverage tx, reset drafts so the panel reflects refreshed onchain position state.
    setInitialCapitalInputAmount(0n);
    setInitialCapitalInputError(null);
    syncInputFieldsFromMultiplier(defaultMultiplierBps);
    if (useLoanAssetInput) {
      void refetchLoanTokenBalance();
    }
    if (onSuccess) onSuccess();
  }, [defaultMultiplierBps, onSuccess, refetchLoanTokenBalance, syncInputFieldsFromMultiplier, useLoanAssetInput]);

  const {
    transaction,
    isLoadingPermit2,
    permit2Authorized,
    leveragePending,
    isBundlerAuthorizationReady,
    approveAndLeverage,
    signAndLeverage,
  } = useLeverageTransaction({
    market,
    route,
    initialCapitalInputAmount,
    initialCapitalCollateralTokenAmount: quote.initialCapitalCollateralTokenAmount,
    flashLegCollateralTokenAmount: quote.flashLegCollateralTokenAmount,
    flashLoanAssetAmount: quote.flashLoanAssetAmount,
    totalCollateralTokenAmountAdded: quote.totalCollateralTokenAmountAdded,
    collateralAssetPriceUsd,
    swapPriceRoute: quote.swapPriceRoute,
    useLoanAssetInput,
    slippageBps: swapSlippageBps,
    onSuccess: handleTransactionSuccess,
  });

  const handleTargetInputModeChange = useCallback(
    (nextUseTargetLtvInput: boolean) => {
      setLeverageUseTargetLtvInput(nextUseTargetLtvInput);
      if (nextUseTargetLtvInput) {
        setTargetLtvIntentBps(targetLtvBps);
      }
      syncInputFieldsFromMultiplier(targetMultiplierBps);
    },
    [setLeverageUseTargetLtvInput, syncInputFieldsFromMultiplier, targetMultiplierBps, targetLtvBps],
  );

  const handleLeverage = useCallback(() => {
    if (!isLeverageFeeReady) return;
    const usePermit2Flow = usePermit2Setting;

    if (usePermit2Flow && permit2Authorized) {
      void signAndLeverage();
      return;
    }

    void approveAndLeverage();
  }, [isLeverageFeeReady, usePermit2Setting, permit2Authorized, signAndLeverage, approveAndLeverage]);

  const projectedOverLimit = projectedLTV >= lltv;
  const insufficientLiquidity = quote.flashLoanAssetAmount > marketLiquidity;
  const inputAssetSymbol = useLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputAssetDecimals = useLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputAssetBalance = useLoanAssetInput ? (loanTokenBalance as bigint | undefined) : collateralTokenBalance;
  const inputTokenIconAddress = useLoanAssetInput ? market.loanAsset.address : market.collateralAsset.address;
  const flashBorrowPreview = useMemo(
    () => formatTokenAmountPreview(quote.flashLoanAssetAmount, market.loanAsset.decimals),
    [quote.flashLoanAssetAmount, market.loanAsset.decimals],
  );
  const totalCollateralAddedPreview = useMemo(
    () => formatTokenAmountPreview(quote.totalCollateralTokenAmountAdded, market.collateralAsset.decimals),
    [quote.totalCollateralTokenAmountAdded, market.collateralAsset.decimals],
  );
  const leverageFeePreview = useMemo(() => {
    if (!isLeverageFeeReady || leverageTransferFee == null) return null;
    return formatTokenAmountPreview(leverageTransferFee, market.collateralAsset.decimals);
  }, [isLeverageFeeReady, leverageTransferFee, market.collateralAsset.decimals]);
  const leverageFeeUsdValue = useMemo(() => {
    if (!isLeverageFeeReady || leverageTransferFee == null || collateralAssetPriceUsd == null) return null;
    return computeAssetUsdValue(leverageTransferFee, market.collateralAsset.decimals, collateralAssetPriceUsd);
  }, [isLeverageFeeReady, leverageTransferFee, collateralAssetPriceUsd, market.collateralAsset.decimals]);
  const leverageFeeUsdDisplay = useMemo(
    () => (leverageFeeUsdValue == null ? null : formatUsdValueDisplay(leverageFeeUsdValue)),
    [leverageFeeUsdValue],
  );
  const swapCollateralOutPreview = useMemo(
    () => formatTokenAmountPreview(quote.flashLegCollateralTokenAmount, market.collateralAsset.decimals),
    [quote.flashLegCollateralTokenAmount, market.collateralAsset.decimals],
  );
  const collateralPreviewForDisplay = isSwapRoute && !useLoanAssetInput ? swapCollateralOutPreview : totalCollateralAddedPreview;
  const collateralPreviewLabel = isSwapRoute
    ? useLoanAssetInput
      ? 'Total Collateral Added (Min.)'
      : 'Collateral From Swap (Min.)'
    : 'Total Collateral Added';
  const hasExecutableInitialCapitalConversion = useMemo(() => {
    if (!useLoanAssetInput) return true;
    if (isSwapRoute) return quote.totalCollateralTokenAmountAdded > 0n;
    if (isErc4626Route) return quote.initialCapitalCollateralTokenAmount > 0n;
    return false;
  }, [useLoanAssetInput, isSwapRoute, isErc4626Route, quote.totalCollateralTokenAmountAdded, quote.initialCapitalCollateralTokenAmount]);
  const swapRatePreviewText = useMemo(() => {
    if (!isSwapRoute || !quote.swapPriceRoute) return null;

    let quotedLoanAmount: bigint;
    let quotedCollateralAmount: bigint;
    try {
      quotedLoanAmount = BigInt(quote.swapPriceRoute.srcAmount);
      quotedCollateralAmount = BigInt(quote.swapPriceRoute.destAmount);
    } catch {
      return null;
    }

    return formatSwapRatePreview({
      baseAmount: quotedCollateralAmount,
      baseTokenDecimals: market.collateralAsset.decimals,
      baseTokenSymbol: market.collateralAsset.symbol,
      quoteAmount: quotedLoanAmount,
      quoteTokenDecimals: market.loanAsset.decimals,
      quoteTokenSymbol: market.loanAsset.symbol,
    });
  }, [
    isSwapRoute,
    quote.swapPriceRoute,
    market.collateralAsset.decimals,
    market.collateralAsset.symbol,
    market.loanAsset.decimals,
    market.loanAsset.symbol,
  ]);
  const shouldShowSwapPreviewDetails = isSwapRoute && quote.swapPriceRoute != null && swapRatePreviewText != null;
  const toDisplayRate = useCallback(
    (apy: number | null): number | null => {
      if (apy == null || !Number.isFinite(apy)) return null;
      const displayRate = toDisplayRateFromApy(apy, isAprDisplay);
      return Number.isFinite(displayRate) ? displayRate : null;
    },
    [isAprDisplay],
  );
  const renderRateFromApy = useCallback((apy: number | null): JSX.Element => {
    if (apy == null || !Number.isFinite(apy)) return <span>-</span>;
    return <RateFormatted value={apy} />;
  }, []);
  const renderRateFromDisplayMode = useCallback(
    (displayRate: number | null): JSX.Element => {
      if (displayRate == null || !Number.isFinite(displayRate)) return <span>-</span>;
      const apyEquivalent = toApyFromDisplayRate(displayRate, isAprDisplay);
      if (!Number.isFinite(apyEquivalent)) return <span>-</span>;
      return <RateFormatted value={apyEquivalent} />;
    },
    [isAprDisplay],
  );
  const fallbackBorrowApy = useMemo(() => {
    if (isErc4626Route && vaultRateInsight.borrowApy3d != null) return vaultRateInsight.borrowApy3d;
    return market.state.borrowApy;
  }, [isErc4626Route, vaultRateInsight.borrowApy3d, market.state.borrowApy]);
  const projectedBorrowApy = useMemo(() => {
    if (!hasChanges) return null;
    const preview = previewMarketState(market, undefined, quote.flashLoanAssetAmount);
    return preview?.borrowApy ?? null;
  }, [hasChanges, market, quote.flashLoanAssetAmount]);
  const previewBorrowApy = projectedBorrowApy ?? fallbackBorrowApy;
  const borrowRatePreviewLabel = projectedBorrowApy != null ? `Borrow ${rateLabel} (Est.)` : `Borrow ${rateLabel}`;
  const vaultTokenApy = isErc4626Route ? vaultRateInsight.vaultApy3d : 0;
  const projectedLtvRatio = useMemo(() => {
    if (projectedBorrowAssets <= 0n) return 0;

    if (isErc4626Route) {
      if (vaultRateInsight.sharePriceNow == null) return null;

      const oneShareUnit = 10n ** BigInt(market.collateralAsset.decimals);
      const collateralUnderlyingAssets = convertVaultSharesToUnderlyingAssets({
        shares: projectedCollateralAssets,
        sharePriceInUnderlying: vaultRateInsight.sharePriceNow,
        oneShareUnit,
      });
      if (collateralUnderlyingAssets <= 0n) return null;

      const ratio = toScaledRatio(projectedBorrowAssets, collateralUnderlyingAssets);
      if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return null;
      return ratio;
    }

    if (projectedCollateralAssets <= 0n) return null;

    const ratio = toScaledRatio(projectedLTV, LTV_WAD);
    if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return null;
    return ratio;
  }, [
    isErc4626Route,
    market.collateralAsset.decimals,
    projectedBorrowAssets,
    projectedCollateralAssets,
    projectedLTV,
    vaultRateInsight.sharePriceNow,
  ]);
  const addedDebtToCollateralRatio = useMemo(() => {
    if (addedBorrowAssets <= 0n) return 0;

    if (isErc4626Route) {
      if (vaultRateInsight.sharePriceNow == null) return null;

      const oneShareUnit = 10n ** BigInt(market.collateralAsset.decimals);
      const addedCollateralUnderlyingAssets = convertVaultSharesToUnderlyingAssets({
        shares: addedCollateralAssets,
        sharePriceInUnderlying: vaultRateInsight.sharePriceNow,
        oneShareUnit,
      });
      if (addedCollateralUnderlyingAssets <= 0n) return null;

      const ratio = Number(addedBorrowAssets) / Number(addedCollateralUnderlyingAssets);
      if (!Number.isFinite(ratio) || ratio < 0) return null;
      return ratio;
    }

    if (addedCollateralAssets <= 0n) return null;

    const addedLtv = computeLtv({
      borrowAssets: addedBorrowAssets,
      collateralAssets: addedCollateralAssets,
      oraclePrice,
    });
    const ratio = Number(addedLtv) / Number(LTV_WAD);
    if (!Number.isFinite(ratio) || ratio < 0) return null;
    return ratio;
  }, [
    addedBorrowAssets,
    addedCollateralAssets,
    isErc4626Route,
    market.collateralAsset.decimals,
    oraclePrice,
    vaultRateInsight.sharePriceNow,
  ]);
  const contributedCapitalAssets = useMemo(() => {
    if (addedCollateralAssets <= 0n) return null;

    if (isSwapRoute && useLoanAssetInput) {
      const totalLoanInput = initialCapitalInputAmount + addedBorrowAssets;
      if (totalLoanInput <= 0n) return null;

      const contributedFromLoanInput = (addedCollateralAssets * initialCapitalInputAmount) / totalLoanInput;
      return contributedFromLoanInput > 0n ? contributedFromLoanInput : null;
    }

    if (quote.totalCollateralTokenAmountAdded <= 0n || quote.initialCapitalCollateralTokenAmount <= 0n) return null;

    const contributedFromInitialCollateral =
      (addedCollateralAssets * quote.initialCapitalCollateralTokenAmount) / quote.totalCollateralTokenAmountAdded;
    return contributedFromInitialCollateral > 0n ? contributedFromInitialCollateral : null;
  }, [
    addedBorrowAssets,
    addedCollateralAssets,
    initialCapitalInputAmount,
    isSwapRoute,
    quote.initialCapitalCollateralTokenAmount,
    quote.totalCollateralTokenAmountAdded,
    useLoanAssetInput,
  ]);
  const holdRewardsApy = useMemo(() => {
    const holdRewardAprDecimal = merklHoldIncentives.holdRewardAprDecimal;
    if (holdRewardAprDecimal == null || !Number.isFinite(holdRewardAprDecimal)) return null;
    const holdRewardApy = convertAprToApy(holdRewardAprDecimal);
    return Number.isFinite(holdRewardApy) ? holdRewardApy : null;
  }, [merklHoldIncentives.holdRewardAprDecimal]);
  const holdRewardsApyForNet = useMemo(() => {
    if (!showFullRewardAPY) return 0;
    return holdRewardsApy ?? 0;
  }, [showFullRewardAPY, holdRewardsApy]);
  const borrowRateForCarry = useMemo(() => toDisplayRate(previewBorrowApy), [previewBorrowApy, toDisplayRate]);
  const vaultTokenRateForCarry = useMemo(() => toDisplayRate(vaultTokenApy), [vaultTokenApy, toDisplayRate]);
  const holdRewardsRateForCarry = useMemo(() => toDisplayRate(holdRewardsApyForNet), [holdRewardsApyForNet, toDisplayRate]);
  const collateralYieldRate = useMemo(() => {
    if (vaultTokenRateForCarry == null) return null;
    return vaultTokenRateForCarry + (holdRewardsRateForCarry ?? 0);
  }, [vaultTokenRateForCarry, holdRewardsRateForCarry]);
  const hasConfiguredHoldRewards = merklHoldIncentives.incentiveLabel != null;
  const shouldShowHoldRewardsRow = hasConfiguredHoldRewards;
  const shouldShowNetRate = isErc4626Route || (showFullRewardAPY && shouldShowHoldRewardsRow);
  const isNetRateLoading =
    (isErc4626Route && (vaultRateInsight.isLoading || vaultRateInsight.vaultApy3d == null || projectedLtvRatio == null)) ||
    (showFullRewardAPY && shouldShowHoldRewardsRow && merklHoldIncentives.loading);
  const holdRewardsLabel = useMemo(
    () => `${merklHoldIncentives.incentiveLabel ?? market.collateralAsset.symbol} Hold Reward (Merkl) ${rateLabel}`,
    [merklHoldIncentives.incentiveLabel, market.collateralAsset.symbol, rateLabel],
  );
  const projectedPositionPreview = useMemo(
    () => formatTokenAmountPreview(projectedCollateralAssets, market.collateralAsset.decimals),
    [projectedCollateralAssets, market.collateralAsset.decimals],
  );
  const addedCapitalPreview = useMemo(() => {
    if (contributedCapitalAssets == null) return null;
    return formatTokenAmountPreview(contributedCapitalAssets, market.collateralAsset.decimals);
  }, [contributedCapitalAssets, market.collateralAsset.decimals]);
  const netCarryLabel = `Net Carry ${rateLabel}`;
  const leveredCarryLabel = `Levered Carry ${rateLabel}`;
  const netCarryDetail = `Expected yearly yield on your full leveraged ${market.collateralAsset.symbol} position.`;
  const netCarrySecondaryDetail = `Projected position size: ${projectedPositionPreview.compact} ${market.collateralAsset.symbol}.`;
  const leveredCarryDetail = `Expected yearly yield on your own added ${market.collateralAsset.symbol} capital.`;
  const leveredCarrySecondaryDetail = `Added capital for this action: ${addedCapitalPreview?.compact ?? '-'} ${market.collateralAsset.symbol}.`;
  const previewExpectedNetRate = useMemo(() => {
    if (collateralYieldRate == null || borrowRateForCarry == null || projectedLtvRatio == null) return null;
    const netRate = collateralYieldRate - projectedLtvRatio * borrowRateForCarry;
    return Number.isFinite(netRate) ? netRate : null;
  }, [collateralYieldRate, borrowRateForCarry, projectedLtvRatio]);
  const previewLeveredCarryOnCapitalRate = useMemo(() => {
    if (
      collateralYieldRate == null ||
      borrowRateForCarry == null ||
      addedDebtToCollateralRatio == null ||
      contributedCapitalAssets == null ||
      addedCollateralAssets <= 0n
    )
      return null;

    const incrementalNetCarryRate = collateralYieldRate - addedDebtToCollateralRatio * borrowRateForCarry;
    if (!Number.isFinite(incrementalNetCarryRate)) return null;

    const leverageFactor = Number(addedCollateralAssets) / Number(contributedCapitalAssets);
    if (!Number.isFinite(leverageFactor) || leverageFactor <= 0) return null;

    const leveredCarryRate = incrementalNetCarryRate * leverageFactor;
    return Number.isFinite(leveredCarryRate) ? leveredCarryRate : null;
  }, [addedCollateralAssets, addedDebtToCollateralRatio, collateralYieldRate, borrowRateForCarry, contributedCapitalAssets]);
  const isLeveredCarryLoading =
    isLeverageFeeReady &&
    ((isErc4626Route && (vaultRateInsight.isLoading || vaultRateInsight.vaultApy3d == null || vaultRateInsight.sharePriceNow == null)) ||
      (showFullRewardAPY && shouldShowHoldRewardsRow && merklHoldIncentives.loading));
  const expectedNetRateClass = useMemo(() => {
    if (previewExpectedNetRate == null) return 'text-secondary';
    return previewExpectedNetRate >= 0 ? 'text-emerald-500' : 'text-red-500';
  }, [previewExpectedNetRate]);
  const leveredCarryRateClass = useMemo(() => {
    if (previewLeveredCarryOnCapitalRate == null) return 'text-secondary';
    return previewLeveredCarryOnCapitalRate >= 0 ? 'text-emerald-500' : 'text-red-500';
  }, [previewLeveredCarryOnCapitalRate]);

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <PreviewSectionHeader
            title="Leverage Preview"
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
            hasChanges={hasChanges}
            useCompactAmountDisplay
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">Initial Capital</p>
                {canUseLoanAssetInput && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-secondary">Use {market.loanAsset.symbol}</div>
                    <IconSwitch
                      size="sm"
                      selected={useLoanAssetInput}
                      onChange={setUseLoanAssetInput}
                      thumbIcon={null}
                      classNames={{
                        wrapper: 'mr-0 h-4 w-9',
                        thumb: 'h-3 w-3',
                      }}
                    />
                  </div>
                )}
              </div>
              <Input
                decimals={inputAssetDecimals}
                max={inputAssetBalance}
                setValue={setInitialCapitalInputAmount}
                setError={setInitialCapitalInputError}
                exceedMaxErrMessage="Insufficient Balance"
                value={initialCapitalInputAmount}
                inputClassName="h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums"
                endAdornment={
                  <TokenIcon
                    address={inputTokenIconAddress}
                    chainId={market.morphoBlue.chain.id}
                    symbol={inputAssetSymbol}
                    width={16}
                    height={16}
                  />
                }
              />
              <div className="mt-1 flex items-start gap-3 text-xs">
                {initialCapitalInputError && <p className="text-red-500">{initialCapitalInputError}</p>}
                <span className="ml-auto text-right text-secondary">
                  Balance: {formatBalance(inputAssetBalance ?? 0n, inputAssetDecimals)} {inputAssetSymbol}
                </span>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">
                  {useTargetLtvInput ? 'Target LTV' : 'Target Multiplier'}
                </p>
                <div className="flex items-center gap-2">
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
              <div className="relative min-w-0">
                {useTargetLtvInput ? (
                  <Input
                    decimals={2}
                    setValue={(nextTargetLtvBps) => {
                      const clampedTargetLtvBps = clampTargetLtvBps(nextTargetLtvBps, maxTargetLtvBps);
                      setTargetLtvIntentBps(clampedTargetLtvBps);
                      setTargetMultiplierBps(multiplierBpsFromTargetLtv(clampedTargetLtvBps, maxMultiplierBps));
                    }}
                    value={targetLtvIntentBps}
                    inputClassName="h-10 rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums"
                    endAdornment={<span className="text-xs text-secondary">%</span>}
                    debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
                  />
                ) : (
                  <Input
                    decimals={4}
                    setValue={syncInputFieldsFromMultiplier}
                    value={multiplierBps}
                    inputClassName="h-10 rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums"
                    endAdornment={<span className="text-xs text-secondary">x</span>}
                    debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
                  />
                )}
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-secondary">Transaction Preview</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{isSwapRoute ? 'Flash Borrow Required' : 'Flash Borrow'}</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="text-xs">{flashBorrowPreview.full}</span>}>
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
                  <span className="text-secondary">{collateralPreviewLabel}</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="text-xs">{collateralPreviewForDisplay.full}</span>}>
                      <span className="cursor-help border-b border-dotted border-white/40">{collateralPreviewForDisplay.compact}</span>
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
                {leverageFeePreview != null && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-0.5 text-secondary">
                      Fee
                      <HelpTooltipIcon
                        content={
                          <SharedTooltipContent
                            title="Fee policy"
                            detail="0.0075% of added collateral, capped at $5 per transaction."
                          />
                        }
                        ariaLabel="Explain leverage fee policy"
                        className="h-auto w-auto"
                      />
                    </span>
                    <span className="tabular-nums inline-flex items-center gap-1.5">
                      <Tooltip
                        content={`${leverageFeePreview.full} ${market.collateralAsset.symbol}`}
                        className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
                      >
                        <span className="cursor-help border-b border-dotted border-white/40">{leverageFeePreview.compact}</span>
                      </Tooltip>
                      {leverageFeeUsdDisplay != null &&
                        (leverageFeeUsdDisplay.showExactTooltip ? (
                          <Tooltip
                            content={`Exact fee: ${leverageFeeUsdDisplay.exact}`}
                            className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
                          >
                            <span className="cursor-help border-b border-dotted border-white/40 text-secondary">
                              {leverageFeeUsdDisplay.display}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-secondary">{leverageFeeUsdDisplay.display}</span>
                        ))}
                      <TokenIcon
                        address={market.collateralAsset.address}
                        chainId={market.morphoBlue.chain.id}
                        symbol={market.collateralAsset.symbol}
                        width={14}
                        height={14}
                      />
                    </span>
                  </div>
                )}
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
                        onChange={setSwapSlippagePercent}
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{borrowRatePreviewLabel}</span>
                  <span className="tabular-nums">{renderRateFromApy(previewBorrowApy)}</span>
                </div>
                {(isErc4626Route || shouldShowHoldRewardsRow || shouldShowNetRate) && (
                  <>
                    <div className="my-1 border-t border-white/10" />
                    {isErc4626Route && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary">Vault Token {rateLabel}</span>
                        <span className="tabular-nums">
                          {vaultRateInsight.isLoading ? '...' : renderRateFromApy(vaultRateInsight.vaultApy3d)}
                        </span>
                      </div>
                    )}
                    {shouldShowHoldRewardsRow && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary">{holdRewardsLabel}</span>
                        <span className="tabular-nums">{merklHoldIncentives.loading ? '...' : renderRateFromApy(holdRewardsApy)}</span>
                      </div>
                    )}
                    {shouldShowNetRate && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            <span className="text-secondary">{netCarryLabel}</span>
                            <HelpTooltipIcon
                              content={
                                <SharedTooltipContent
                                  title={netCarryLabel}
                                  detail={netCarryDetail}
                                  secondaryDetail={netCarrySecondaryDetail}
                                />
                              }
                              ariaLabel={`Explain ${netCarryLabel}`}
                              className="h-auto w-auto"
                            />
                          </div>
                          <span className={`tabular-nums ${expectedNetRateClass}`}>
                            {isNetRateLoading ? '...' : renderRateFromDisplayMode(previewExpectedNetRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            <span className="text-secondary">{leveredCarryLabel}</span>
                            <HelpTooltipIcon
                              content={
                                <SharedTooltipContent
                                  title={leveredCarryLabel}
                                  detail={leveredCarryDetail}
                                  secondaryDetail={leveredCarrySecondaryDetail}
                                />
                              }
                              ariaLabel={`Explain ${leveredCarryLabel}`}
                              className="h-auto w-auto"
                            />
                          </div>
                          <span className={`tabular-nums ${leveredCarryRateClass}`}>
                            {isLeveredCarryLoading ? '...' : renderRateFromDisplayMode(previewLeveredCarryOnCapitalRate)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
              {!quote.error && leverageFeeReadinessError && <p className="mt-2 text-xs text-red-500">{leverageFeeReadinessError}</p>}
              {isErc4626Route && vaultRateInsight.error && (
                <p className="mt-2 text-xs text-red-500">Failed to fetch 3-day vault/borrow rates: {vaultRateInsight.error}</p>
              )}
              {merklHoldIncentives.error && (
                <p className="mt-2 text-xs text-red-500">Failed to fetch Merkl hold rewards: {merklHoldIncentives.error}</p>
              )}
              {insufficientLiquidity && (
                <p className="mt-2 text-xs text-red-500">
                  Flash loan repayment borrow exceeds market liquidity ({formatBalance(marketLiquidity, market.loanAsset.decimals)}{' '}
                  {market.loanAsset.symbol} available).
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleLeverage}
                isLoading={isLoadingPermit2 || leveragePending || quote.isLoading}
                disabled={
                  route == null ||
                  initialCapitalInputError !== null ||
                  quote.error !== null ||
                  initialCapitalInputAmount <= 0n ||
                  !isBundlerAuthorizationReady ||
                  !hasExecutableInitialCapitalConversion ||
                  !isLeverageFeeReady ||
                  quote.flashLoanAssetAmount <= 0n ||
                  projectedOverLimit ||
                  insufficientLiquidity
                }
                variant="primary"
                className="min-w-32"
              >
                Leverage
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
