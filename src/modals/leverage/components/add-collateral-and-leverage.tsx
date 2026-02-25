import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi } from 'viem';
import { useBalance, useConnection, useReadContract } from 'wagmi';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { erc4626Abi } from '@/abis/erc4626';
import { wstEthAbi } from '@/abis/wsteth';
import { useLeverageQuote } from '@/hooks/useLeverageQuote';
import { useLeverageTransaction } from '@/hooks/useLeverageTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getNativeTokenSymbol } from '@/utils/networks';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { Market, MarketPosition } from '@/utils/types';
import type { LeverageSupport } from '@/hooks/leverage/types';
import { computeLtv, formatLtvPercent, getLTVColor } from '@/modals/borrow/components/helpers';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import { clampMultiplierBps, formatMultiplierBps, parseMultiplierToBps } from '@/hooks/leverage/math';
import { LEVERAGE_DEFAULT_MULTIPLIER_BPS } from '@/hooks/leverage/types';

type AddCollateralAndLeverageProps = {
  market: Market;
  support: LeverageSupport;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
  showDeleverageManualRepayNotice?: boolean;
};

const MULTIPLIER_INPUT_REGEX = /^\d*\.?\d*$/;
const STETH_ETH_DELEVERAGE_NOTICE_KEY = 'hasReadStEthEthDeleverageNotice';
const STETH_DISPLAY_SYMBOL = 'stETH';

export function AddCollateralAndLeverage({
  market,
  support,
  currentPosition,
  collateralTokenBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
  showDeleverageManualRepayNotice = false,
}: AddCollateralAndLeverageProps): JSX.Element {
  const route = support.route;
  const { address: account } = useConnection();
  const { usePermit2: usePermit2Setting } = useAppSettings();

  const [collateralAmount, setCollateralAmount] = useState<bigint>(0n);
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [multiplierInput, setMultiplierInput] = useState<string>(formatMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS));
  const [useEth, setUseEth] = useState(false);
  const [useLoanAssetInput, setUseLoanAssetInput] = useState(false);
  const [showRouteNotice, setShowRouteNotice] = useState(false);

  const multiplierBps = useMemo(() => clampMultiplierBps(parseMultiplierToBps(multiplierInput)), [multiplierInput]);

  const isMainnetEthStEthRoute = route?.kind === 'steth' && route.loanMode === 'mainnet-weth-steth-wsteth';
  const isErc4626Route = route?.kind === 'erc4626';

  const { data: nativeBalance } = useBalance({
    address: account as `0x${string}` | undefined,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account && isMainnetEthStEthRoute,
    },
  });

  const { data: loanTokenBalance } = useReadContract({
    address: market.loanAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account && isErc4626Route,
    },
  });

  const {
    data: convertedWstEthAmount,
    isLoading: isLoadingEthToWstEthConversion,
    error: ethToWstEthConversionError,
  } = useReadContract({
    address: route?.kind === 'steth' ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getWstETHByStETH',
    args: [collateralAmount],
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: isMainnetEthStEthRoute && useEth && collateralAmount > 0n,
    },
  });

  useEffect(() => {
    // ETH and wstETH inputs have different units. Reset the amount to avoid accidental cross-unit reuse.
    setCollateralAmount(0n);
    setCollateralInputError(null);
  }, [useEth]);

  useEffect(() => {
    // Underlying and collateral shares use different units. Reset amount when switching input source.
    setCollateralAmount(0n);
    setCollateralInputError(null);
  }, [useLoanAssetInput]);

  useEffect(() => {
    if (isMainnetEthStEthRoute) return;
    setUseEth(false);
  }, [isMainnetEthStEthRoute]);

  useEffect(() => {
    if (isErc4626Route) return;
    setUseLoanAssetInput(false);
  }, [isErc4626Route]);

  useEffect(() => {
    if (!showDeleverageManualRepayNotice) {
      setShowRouteNotice(false);
      return;
    }

    const hasReadNotice = localStorage.getItem(STETH_ETH_DELEVERAGE_NOTICE_KEY) === 'true';
    setShowRouteNotice(!hasReadNotice);
  }, [showDeleverageManualRepayNotice]);

  const handleDismissRouteNotice = useCallback(() => {
    localStorage.setItem(STETH_ETH_DELEVERAGE_NOTICE_KEY, 'true');
    setShowRouteNotice(false);
  }, []);

  const collateralAmountInCollateralToken = useMemo(() => {
    // WHY: leverage math is always computed in the market collateral token units.
    // For ETH input mode, we first map user ETH -> wstETH before applying multiplier,
    // so target collateral remains deterministic with the actual supplied token.
    if (!useEth) return collateralAmount;
    return (convertedWstEthAmount as bigint | undefined) ?? 0n;
  }, [useEth, collateralAmount, convertedWstEthAmount]);

  const {
    data: previewCollateralSharesFromUnderlying,
    isLoading: isLoadingUnderlyingToCollateralConversion,
    error: underlyingToCollateralConversionError,
  } = useReadContract({
    // WHY: for ERC4626 "start with loan asset" mode, user input is underlying assets.
    // We convert to collateral shares first so multiplier/flash math stays in collateral units.
    address: route?.kind === 'erc4626' ? route.collateralVault : undefined,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [collateralAmount],
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: isErc4626Route && useLoanAssetInput && collateralAmount > 0n,
    },
  });

  const collateralAmountForLeverageQuote = useMemo(() => {
    if (useEth) return collateralAmountInCollateralToken;
    if (useLoanAssetInput) return (previewCollateralSharesFromUnderlying as bigint | undefined) ?? 0n;
    return collateralAmount;
  }, [useEth, useLoanAssetInput, collateralAmountInCollateralToken, previewCollateralSharesFromUnderlying, collateralAmount]);

  const conversionErrorMessage = useMemo(() => {
    if (useEth && ethToWstEthConversionError) {
      return ethToWstEthConversionError instanceof Error ? ethToWstEthConversionError.message : 'Failed to quote ETH to wstETH conversion.';
    }
    if (useLoanAssetInput && underlyingToCollateralConversionError) {
      return underlyingToCollateralConversionError instanceof Error
        ? underlyingToCollateralConversionError.message
        : 'Failed to quote loan asset to collateral conversion.';
    }
    return null;
  }, [useEth, ethToWstEthConversionError, useLoanAssetInput, underlyingToCollateralConversionError]);

  const quote = useLeverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    userCollateralAmount: collateralAmountForLeverageQuote,
    multiplierBps,
  });

  const currentCollateralAssets = BigInt(currentPosition?.state.collateral ?? 0);
  const currentBorrowAssets = BigInt(currentPosition?.state.borrowAssets ?? 0);
  const projectedCollateralAssets = currentCollateralAssets + quote.totalAddedCollateral;
  const projectedBorrowAssets = currentBorrowAssets + quote.flashLoanAmount;
  const lltv = BigInt(market.lltv);
  const marketLiquidity = BigInt(market.state.liquidityAssets);
  const isEthInputStEthRoute = isMainnetEthStEthRoute && useEth && route?.kind === 'steth';

  const { data: currentCollateralInStEth } = useReadContract({
    address: route?.kind === 'steth' ? route.collateralToken : undefined,
    abi: wstEthAbi,
    functionName: 'getStETHByWstETH',
    args: [currentCollateralAssets],
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: isEthInputStEthRoute && currentCollateralAssets > 0n,
    },
  });

  const addedCollateralInStEth = useMemo(() => {
    if (!isEthInputStEthRoute) return 0n;
    // WHY: for ETH input mode, leverage target is defined on ETH/stETH exposure.
    // Added collateral in stETH terms is user ETH leg + flash-borrowed stETH-equivalent debt leg.
    return collateralAmount + quote.flashLoanAmount;
  }, [isEthInputStEthRoute, collateralAmount, quote.flashLoanAmount]);

  const canUseStEthDisplayForPosition = useMemo(() => {
    if (!isEthInputStEthRoute) return false;
    if (currentCollateralAssets === 0n) return true;
    return currentCollateralInStEth !== undefined;
  }, [isEthInputStEthRoute, currentCollateralAssets, currentCollateralInStEth]);

  const previewCurrentCollateral = useMemo(() => {
    if (!isEthInputStEthRoute || !canUseStEthDisplayForPosition) return currentCollateralAssets;
    if (currentCollateralAssets === 0n) return 0n;
    return (currentCollateralInStEth as bigint | undefined) ?? 0n;
  }, [isEthInputStEthRoute, canUseStEthDisplayForPosition, currentCollateralAssets, currentCollateralInStEth]);

  const previewProjectedCollateral = useMemo(() => {
    if (!isEthInputStEthRoute || !canUseStEthDisplayForPosition) return projectedCollateralAssets;
    return previewCurrentCollateral + addedCollateralInStEth;
  }, [isEthInputStEthRoute, canUseStEthDisplayForPosition, projectedCollateralAssets, previewCurrentCollateral, addedCollateralInStEth]);

  const previewMarket = useMemo(() => {
    if (!isEthInputStEthRoute || !canUseStEthDisplayForPosition || route?.kind !== 'steth') return market;
    return {
      ...market,
      collateralAsset: {
        ...market.collateralAsset,
        address: route.stEthToken,
        symbol: STETH_DISPLAY_SYMBOL,
        decimals: 18,
      },
    };
  }, [isEthInputStEthRoute, canUseStEthDisplayForPosition, route, market]);

  const transactionPreviewCollateralAmount = useMemo(() => {
    if (!isEthInputStEthRoute) return quote.totalAddedCollateral;
    return addedCollateralInStEth;
  }, [isEthInputStEthRoute, quote.totalAddedCollateral, addedCollateralInStEth]);

  const transactionPreviewCollateralAddress =
    isEthInputStEthRoute && route?.kind === 'steth' ? route.stEthToken : market.collateralAsset.address;
  const transactionPreviewCollateralSymbol = isEthInputStEthRoute ? STETH_DISPLAY_SYMBOL : market.collateralAsset.symbol;
  const transactionPreviewCollateralDecimals = isEthInputStEthRoute ? 18 : market.collateralAsset.decimals;

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

  const handleTransactionSuccess = useCallback(() => {
    // WHY: after a confirmed leverage tx, we reset draft inputs so the panel reflects the live position state.
    setCollateralAmount(0n);
    setCollateralInputError(null);
    setMultiplierInput(formatMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS));
    if (onSuccess) onSuccess();
  }, [onSuccess]);

  const { transaction, isLoadingPermit2, isApproved, permit2Authorized, leveragePending, approveAndLeverage, signAndLeverage } =
    useLeverageTransaction({
      market,
      route: route!,
      collateralAmount,
      collateralAmountInCollateralToken: collateralAmountForLeverageQuote,
      flashCollateralAmount: quote.flashCollateralAmount,
      flashLoanAmount: quote.flashLoanAmount,
      useEth,
      useLoanAssetAsInput: useLoanAssetInput,
      onSuccess: handleTransactionSuccess,
    });

  const handleMultiplierInputChange = useCallback((value: string) => {
    const normalized = value.replace(',', '.');
    if (!MULTIPLIER_INPUT_REGEX.test(normalized)) return;
    setMultiplierInput(normalized);
  }, []);

  const handleMultiplierInputBlur = useCallback(() => {
    setMultiplierInput(formatMultiplierBps(clampMultiplierBps(parseMultiplierToBps(multiplierInput))));
  }, [multiplierInput]);

  const handleLeverage = useCallback(() => {
    if (useEth) {
      void approveAndLeverage();
      return;
    }

    if (usePermit2Setting && permit2Authorized) {
      void signAndLeverage();
      return;
    }
    if (!usePermit2Setting && isApproved) {
      void approveAndLeverage();
      return;
    }
    void approveAndLeverage();
  }, [useEth, usePermit2Setting, permit2Authorized, signAndLeverage, isApproved, approveAndLeverage]);

  const projectedOverLimit = projectedLTV >= lltv;
  const insufficientLiquidity = quote.flashLoanAmount > marketLiquidity;
  const hasChanges = collateralAmountForLeverageQuote > 0n && quote.flashLoanAmount > 0n;
  const inputAssetSymbol = useEth
    ? getNativeTokenSymbol(market.morphoBlue.chain.id)
    : useLoanAssetInput
      ? market.loanAsset.symbol
      : market.collateralAsset.symbol;
  const inputAssetDecimals = useEth ? 18 : useLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputAssetBalance = useEth
    ? nativeBalance?.value
    : useLoanAssetInput
      ? (loanTokenBalance as bigint | undefined)
      : collateralTokenBalance;
  const inputTokenIconAddress = useEth
    ? market.loanAsset.address
    : useLoanAssetInput
      ? market.loanAsset.address
      : market.collateralAsset.address;
  const isLoadingInputConversion = useEth
    ? isLoadingEthToWstEthConversion
    : useLoanAssetInput
      ? isLoadingUnderlyingToCollateralConversion
      : false;

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Leverage Preview</p>
          <BorrowPositionRiskCard
            market={previewMarket}
            currentCollateral={previewCurrentCollateral}
            currentBorrow={currentBorrowAssets}
            projectedCollateral={previewProjectedCollateral}
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
                  {useLoanAssetInput
                    ? `Mints ${market.collateralAsset.symbol} collateral`
                    : `Add Collateral ${inputAssetSymbol}`}
                </p>
                {isMainnetEthStEthRoute && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-secondary">Use {getNativeTokenSymbol(market.morphoBlue.chain.id)}</div>
                    <IconSwitch
                      size="sm"
                      selected={useEth}
                      onChange={setUseEth}
                      thumbIcon={null}
                      classNames={{
                        wrapper: 'mr-0 h-4 w-9',
                        thumb: 'h-3 w-3',
                      }}
                    />
                  </div>
                )}
                {isErc4626Route && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-secondary">Start with {market.loanAsset.symbol}</div>
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
                <span className="min-h-4 text-left text-red-500">{collateralInputError ?? ''}</span>
                <span className="text-right text-secondary">
                  Balance: {formatBalance(inputAssetBalance ?? 0n, inputAssetDecimals)} {inputAssetSymbol}
                </span>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Target Multiplier</p>
              <div className="relative min-w-0">
                <input
                  type="text"
                  inputMode="decimal"
                  value={multiplierInput}
                  onChange={(event) => handleMultiplierInputChange(event.target.value)}
                  onBlur={handleMultiplierInputBlur}
                  className="h-10 w-full rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums focus:border-primary focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">x</span>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Transaction Preview</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Flash Borrow</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip
                      content={
                        <span className="font-monospace text-xs">
                          {formatFullTokenAmount(quote.flashLoanAmount, market.loanAsset.decimals)}
                        </span>
                      }
                    >
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {formatCompactTokenAmount(quote.flashLoanAmount, market.loanAsset.decimals)}
                      </span>
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
                  <span className="text-secondary">Total Collateral Added</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip
                      content={
                        <span className="font-monospace text-xs">
                          {formatFullTokenAmount(transactionPreviewCollateralAmount, transactionPreviewCollateralDecimals)}
                        </span>
                      }
                    >
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {formatCompactTokenAmount(transactionPreviewCollateralAmount, transactionPreviewCollateralDecimals)}
                      </span>
                    </Tooltip>
                    <TokenIcon
                      address={transactionPreviewCollateralAddress}
                      chainId={market.morphoBlue.chain.id}
                      symbol={transactionPreviewCollateralSymbol}
                      width={14}
                      height={14}
                    />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Projected LTV</span>
                  <span className={`tabular-nums ${getLTVColor(projectedLTV, lltv)}`}>{formatLtvPercent(projectedLTV)}%</span>
                </div>
              </div>
              {conversionErrorMessage && <p className="mt-2 text-xs text-red-500">{conversionErrorMessage}</p>}
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
              {insufficientLiquidity && (
                <p className="mt-2 text-xs text-red-500">
                  Flash loan repayment borrow exceeds market liquidity ({formatBalance(marketLiquidity, market.loanAsset.decimals)}{' '}
                  {market.loanAsset.symbol} available).
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            {showRouteNotice && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded border border-primary/20 bg-primary/5 px-3 py-2.5">
                <p className="text-xs leading-5 text-secondary">
                  Deleverage is not supported for this stETH-ETH route yet. To reduce exposure, manually repay debt for now.
                </p>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-auto shrink-0 px-2 py-1 text-xs text-primary"
                  onClick={handleDismissRouteNotice}
                >
                  Dismiss
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleLeverage}
                isLoading={isLoadingPermit2 || leveragePending || quote.isLoading || isLoadingInputConversion}
                disabled={
                  !support.supportsLeverage ||
                  route == null ||
                  collateralInputError !== null ||
                  conversionErrorMessage !== null ||
                  quote.error !== null ||
                  collateralAmount <= 0n ||
                  ((useEth || useLoanAssetInput) && collateralAmountForLeverageQuote <= 0n) ||
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
