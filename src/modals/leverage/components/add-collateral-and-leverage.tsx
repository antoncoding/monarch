import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import {
  clampEditablePercent,
  computeLtv,
  formatEditableLtvPercent,
} from '@/modals/borrow/components/helpers';
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
  computeLeverageProjectedPosition,
  formatPercentFromBps,
  formatMultiplierBps,
  formatTokenAmountPreview,
  ltvWadToBps,
  multiplierBpsFromTargetLtv,
  parsePercentToBps,
  parseMultiplierToBps,
  targetLtvBpsFromMultiplier,
} from '@/hooks/leverage/math';
import { LEVERAGE_DEFAULT_MULTIPLIER_BPS } from '@/hooks/leverage/types';
import { use4626VaultAPR } from '@/hooks/use4626VaultAPR';
import { useLeverageQuote } from '@/hooks/useLeverageQuote';
import { useLeverageTransaction } from '@/hooks/useLeverageTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { SlippageInlineEditor } from '@/features/swap/components/SlippageInlineEditor';
import { DEFAULT_SLIPPAGE_PERCENT, slippagePercentToBps } from '@/features/swap/constants';
import { formatSwapRatePreview } from '@/features/swap/utils/quote-preview';
import { formatBalance } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
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

const EDITABLE_DECIMAL_INPUT_REGEX = /^\d*[.,]?\d*$/;
const LEVERAGE_SAFE_LTV_BUFFER_BPS = 100n; // keep a 1% buffer below liquidation LTV

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
  const { usePermit2: usePermit2Setting, isAprDisplay } = useAppSettings();
  const lltv = BigInt(market.lltv);
  const lltvBps = useMemo(() => ltvWadToBps(lltv), [lltv]);
  const maxTargetLtvBps = useMemo(() => (lltvBps > LEVERAGE_SAFE_LTV_BUFFER_BPS ? lltvBps - LEVERAGE_SAFE_LTV_BUFFER_BPS : 0n), [lltvBps]);
  const maxMultiplierBps = useMemo(() => computeMaxMultiplierBpsForTargetLtv(maxTargetLtvBps), [maxTargetLtvBps]);
  const defaultMultiplierBps = useMemo(() => clampMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS, maxMultiplierBps), [maxMultiplierBps]);

  const [collateralAmount, setCollateralAmount] = useState<bigint>(0n);
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [multiplierInput, setMultiplierInput] = useState<string>(formatMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS, maxMultiplierBps));
  const [targetLtvInput, setTargetLtvInput] = useState<string>(
    formatPercentFromBps(clampTargetLtvBps(targetLtvBpsFromMultiplier(LEVERAGE_DEFAULT_MULTIPLIER_BPS), maxTargetLtvBps)),
  );
  const [useTargetLtvInput, setUseTargetLtvInput] = useState(true);
  const [useLoanAssetInput, setUseLoanAssetInput] = useState(false);
  const [targetMultiplierBps, setTargetMultiplierBps] = useState<bigint>(defaultMultiplierBps);
  const [swapSlippagePercent, setSwapSlippagePercent] = useState<number>(DEFAULT_SLIPPAGE_PERCENT);

  const multiplierBps = useMemo(() => clampMultiplierBps(targetMultiplierBps, maxMultiplierBps), [targetMultiplierBps, maxMultiplierBps]);
  const targetLtvBps = useMemo(
    () => clampTargetLtvBps(targetLtvBpsFromMultiplier(multiplierBps), maxTargetLtvBps),
    [multiplierBps, maxTargetLtvBps],
  );
  const swapSlippageBps = useMemo(() => slippagePercentToBps(swapSlippagePercent), [swapSlippagePercent]);
  const maxTargetLtvPercent = useMemo(() => Number(maxTargetLtvBps) / 100, [maxTargetLtvBps]);
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
    // Underlying and collateral shares use different units. Reset amount when switching input source.
    setCollateralAmount(0n);
    setCollateralInputError(null);
  }, [useLoanAssetInput]);

  useEffect(() => {
    if (canUseLoanAssetInput) return;
    setUseLoanAssetInput(false);
  }, [canUseLoanAssetInput]);

  useEffect(() => {
    const clampedMultiplier = clampMultiplierBps(targetMultiplierBps, maxMultiplierBps);
    if (clampedMultiplier === targetMultiplierBps) return;
    setTargetMultiplierBps(clampedMultiplier);
    setMultiplierInput(formatMultiplierBps(clampedMultiplier, maxMultiplierBps));
    setTargetLtvInput(formatPercentFromBps(clampTargetLtvBps(targetLtvBpsFromMultiplier(clampedMultiplier), maxTargetLtvBps)));
  }, [targetMultiplierBps, maxMultiplierBps, maxTargetLtvBps]);

  const quote = useLeverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    userInputAmount: collateralAmount,
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
  const { projectedCollateralAssets, projectedBorrowAssets } = useMemo(
    () =>
      computeLeverageProjectedPosition({
        currentCollateralAssets,
        currentBorrowAssets,
        addedCollateralAssets: quote.totalAddedCollateral,
        addedBorrowAssets: quote.flashLoanAmount,
      }),
    [currentCollateralAssets, currentBorrowAssets, quote.totalAddedCollateral, quote.flashLoanAmount],
  );
  const marketLiquidity = BigInt(market.state.liquidityAssets);
  const rateLabel = isAprDisplay ? 'APR' : 'APY';

  const vaultRateInsight = use4626VaultAPR({
    market,
    vaultAddress: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    projectedCollateralShares: projectedCollateralAssets,
    projectedBorrowAssets,
    enabled: isErc4626Route,
    lookbackDays: 3,
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
      setMultiplierInput(formatMultiplierBps(clampedMultiplier, maxMultiplierBps));
      setTargetLtvInput(formatPercentFromBps(derivedTargetLtvBps));
    },
    [maxMultiplierBps, maxTargetLtvBps],
  );

  const handleTransactionSuccess = useCallback(() => {
    // WHY: after a confirmed leverage tx, reset drafts so the panel reflects refreshed onchain position state.
    setCollateralAmount(0n);
    setCollateralInputError(null);
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
    collateralAmount,
    collateralAmountInCollateralToken: quote.initialCollateralAmount,
    flashCollateralAmount: quote.flashCollateralAmount,
    flashLoanAmount: quote.flashLoanAmount,
    totalAddedCollateral: quote.totalAddedCollateral,
    swapPriceRoute: quote.swapPriceRoute,
    useLoanAssetAsInput: useLoanAssetInput,
    slippageBps: swapSlippageBps,
    onSuccess: handleTransactionSuccess,
  });

  const handleMultiplierInputChange = useCallback(
    (value: string) => {
      if (!EDITABLE_DECIMAL_INPUT_REGEX.test(value)) return;
      setMultiplierInput(value);
    },
    [],
  );

  const handleMultiplierInputBlur = useCallback(() => {
    syncInputFieldsFromMultiplier(parseMultiplierToBps(multiplierInput, maxMultiplierBps));
  }, [multiplierInput, maxMultiplierBps, syncInputFieldsFromMultiplier]);

  const handleTargetLtvInputChange = useCallback(
    (value: string) => {
      if (!EDITABLE_DECIMAL_INPUT_REGEX.test(value)) return;
      setTargetLtvInput(value);
    },
    [],
  );

  const handleTargetLtvInputBlur = useCallback(() => {
    const parsedPercent = Number.parseFloat(targetLtvInput.replace(',', '.'));
    if (!Number.isFinite(parsedPercent)) {
      setTargetLtvInput(formatEditableLtvPercent(Number(targetLtvBps) / 100, maxTargetLtvPercent));
      return;
    }
    const clampedPercent = clampEditablePercent(parsedPercent, maxTargetLtvPercent);
    const clampedTargetLtvBps = clampTargetLtvBps(parsePercentToBps(clampedPercent.toString(), maxTargetLtvBps), maxTargetLtvBps);
    syncInputFieldsFromMultiplier(multiplierBpsFromTargetLtv(clampedTargetLtvBps, maxMultiplierBps));
  }, [targetLtvInput, targetLtvBps, maxMultiplierBps, maxTargetLtvBps, maxTargetLtvPercent, syncInputFieldsFromMultiplier]);

  const handleTargetInputModeChange = useCallback(
    (nextUseTargetLtvInput: boolean) => {
      setUseTargetLtvInput(nextUseTargetLtvInput);
      syncInputFieldsFromMultiplier(targetMultiplierBps);
    },
    [syncInputFieldsFromMultiplier, targetMultiplierBps],
  );

  const handleLeverage = useCallback(() => {
    const usePermit2Flow = usePermit2Setting;

    if (usePermit2Flow && permit2Authorized) {
      void signAndLeverage();
      return;
    }

    void approveAndLeverage();
  }, [usePermit2Setting, permit2Authorized, signAndLeverage, approveAndLeverage]);

  const projectedOverLimit = projectedLTV >= lltv;
  const insufficientLiquidity = quote.flashLoanAmount > marketLiquidity;
  const hasChanges = quote.totalAddedCollateral > 0n && quote.flashLoanAmount > 0n;
  const inputAssetSymbol = useLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputAssetDecimals = useLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputAssetBalance = useLoanAssetInput ? (loanTokenBalance as bigint | undefined) : collateralTokenBalance;
  const inputTokenIconAddress = useLoanAssetInput ? market.loanAsset.address : market.collateralAsset.address;
  const flashBorrowPreview = useMemo(
    () => formatTokenAmountPreview(quote.flashLoanAmount, market.loanAsset.decimals),
    [quote.flashLoanAmount, market.loanAsset.decimals],
  );
  const totalCollateralAddedPreview = useMemo(
    () => formatTokenAmountPreview(quote.totalAddedCollateral, market.collateralAsset.decimals),
    [quote.totalAddedCollateral, market.collateralAsset.decimals],
  );
  const swapCollateralOutPreview = useMemo(
    () => formatTokenAmountPreview(quote.flashCollateralAmount, market.collateralAsset.decimals),
    [quote.flashCollateralAmount, market.collateralAsset.decimals],
  );
  const initialCollateralPreview = useMemo(
    () => formatTokenAmountPreview(quote.initialCollateralAmount, market.collateralAsset.decimals),
    [quote.initialCollateralAmount, market.collateralAsset.decimals],
  );
  const collateralPreviewForDisplay = isSwapRoute && !useLoanAssetInput ? swapCollateralOutPreview : totalCollateralAddedPreview;
  const collateralPreviewLabel = isSwapRoute
    ? useLoanAssetInput
      ? 'Total Collateral Added (Min.)'
      : 'Collateral From Swap (Min.)'
    : 'Total Collateral Added';
  const hasExecutableInputConversion = useMemo(() => {
    if (!useLoanAssetInput) return true;
    if (isSwapRoute) return quote.totalAddedCollateral > 0n;
    if (isErc4626Route) return quote.initialCollateralAmount > 0n;
    return false;
  }, [useLoanAssetInput, isSwapRoute, isErc4626Route, quote.totalAddedCollateral, quote.initialCollateralAmount]);
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
      baseAmount: quotedLoanAmount,
      baseTokenDecimals: market.loanAsset.decimals,
      baseTokenSymbol: market.loanAsset.symbol,
      quoteAmount: quotedCollateralAmount,
      quoteTokenDecimals: market.collateralAsset.decimals,
      quoteTokenSymbol: market.collateralAsset.symbol,
    });
  }, [
    isSwapRoute,
    quote.swapPriceRoute,
    market.loanAsset.decimals,
    market.loanAsset.symbol,
    market.collateralAsset.decimals,
    market.collateralAsset.symbol,
  ]);
  const shouldShowSwapPreviewDetails = isSwapRoute && quote.swapPriceRoute != null && swapRatePreviewText != null;
  const shouldShowInputConversionPreview = isErc4626Route && useLoanAssetInput && quote.initialCollateralAmount > 0n;
  const renderRateValue = useCallback(
    (apy: number | null): JSX.Element => {
      if (apy == null || !Number.isFinite(apy)) return <span className="font-monospace">-</span>;
      const displayRate = isAprDisplay ? convertApyToApr(apy) : apy;
      if (!Number.isFinite(displayRate)) return <span className="font-monospace">-</span>;

      const isNegative = displayRate < 0;
      const absolutePercent = Math.abs(displayRate * 100).toFixed(2);

      return (
        <>
          {isNegative && <span className="font-monospace">-</span>}
          {absolutePercent}%
        </>
      );
    },
    [isAprDisplay],
  );
  const expectedNetRateClass = useMemo(() => {
    if (vaultRateInsight.expectedNetApy == null) return 'text-secondary';
    return vaultRateInsight.expectedNetApy >= 0 ? 'text-emerald-500' : 'text-red-500';
  }, [vaultRateInsight.expectedNetApy]);
  const previewBorrowApy = useMemo(() => {
    // Prefer route-specific observed borrow carry for ERC4626 when available, fallback to market live borrow APY.
    if (isErc4626Route && vaultRateInsight.borrowApy3d != null) return vaultRateInsight.borrowApy3d;
    return market.state.borrowApy;
  }, [isErc4626Route, vaultRateInsight.borrowApy3d, market.state.borrowApy]);

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Leverage Preview</p>
          <BorrowPositionRiskCard
            market={market}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            projectedCollateral={projectedCollateralAssets}
            projectedBorrow={projectedBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={projectedLTV}
            lltv={lltv}
            onRefresh={onSuccess}
            isRefreshing={isRefreshing}
            hasChanges={hasChanges}
            useCompactAmountDisplay
          />

          <div className="mt-2 space-y-3">
            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
                  {useLoanAssetInput ? `Start with ${market.loanAsset.symbol}` : `Add Collateral ${market.collateralAsset.symbol}`}
                </p>
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
                setValue={setCollateralAmount}
                setError={setCollateralInputError}
                exceedMaxErrMessage="Insufficient Balance"
                value={collateralAmount}
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
              <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-right text-secondary">
                  Balance: {formatBalance(inputAssetBalance ?? 0n, inputAssetDecimals)} {inputAssetSymbol}
                </span>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
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
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0}
                      max={maxTargetLtvPercent}
                      step={0.01}
                      value={targetLtvInput}
                      onChange={(event) => handleTargetLtvInputChange(event.target.value)}
                      onBlur={handleTargetLtvInputBlur}
                      className="h-10 w-full rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums focus:border-primary focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">%</span>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={multiplierInput}
                      onChange={(event) => handleMultiplierInputChange(event.target.value)}
                      onBlur={handleMultiplierInputBlur}
                      className="h-10 w-full rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums focus:border-primary focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">x</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Transaction Preview</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">{isSwapRoute ? 'Flash Borrow Required' : 'Flash Borrow'}</span>
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
                  <span className="text-secondary">{collateralPreviewLabel}</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip content={<span className="font-monospace text-xs">{collateralPreviewForDisplay.full}</span>}>
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
                {shouldShowInputConversionPreview && (
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Collateral Shares From Input</span>
                    <span className="tabular-nums inline-flex items-center gap-1.5">
                      <Tooltip content={<span className="font-monospace text-xs">{initialCollateralPreview.full}</span>}>
                        <span className="cursor-help border-b border-dotted border-white/40">{initialCollateralPreview.compact}</span>
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
                  <span className="text-secondary">Borrow {rateLabel}</span>
                  <span className="tabular-nums">{renderRateValue(previewBorrowApy)}</span>
                </div>
                {isErc4626Route && (
                  <>
                    <div className="my-1 border-t border-white/10" />
                    <div className="flex items-center justify-between">
                      <span className="text-secondary">Vault Token {rateLabel}</span>
                      <span className="tabular-nums">
                        {vaultRateInsight.isLoading ? '...' : renderRateValue(vaultRateInsight.vaultApy3d)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary">Net {rateLabel}</span>
                      <span className={`tabular-nums ${expectedNetRateClass}`}>
                        {vaultRateInsight.isLoading ? '...' : renderRateValue(vaultRateInsight.expectedNetApy)}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
              {isErc4626Route && vaultRateInsight.error && (
                <p className="mt-2 text-xs text-red-500">Failed to fetch 3-day vault/borrow rates: {vaultRateInsight.error}</p>
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
                  collateralInputError !== null ||
                  quote.error !== null ||
                  collateralAmount <= 0n ||
                  !isBundlerAuthorizationReady ||
                  !hasExecutableInputConversion ||
                  quote.flashLoanAmount <= 0n ||
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
