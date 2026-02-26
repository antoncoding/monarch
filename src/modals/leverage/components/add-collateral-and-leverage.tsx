import { useCallback, useEffect, useMemo, useState } from 'react';
import { erc20Abi } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';
import { computeLtv, formatLtvPercent, getLTVColor } from '@/modals/borrow/components/helpers';
import Input from '@/components/Input/Input';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { erc4626Abi } from '@/abis/erc4626';
import { clampMultiplierBps, formatMultiplierBps, parseMultiplierToBps } from '@/hooks/leverage/math';
import { LEVERAGE_DEFAULT_MULTIPLIER_BPS } from '@/hooks/leverage/types';
import { useLeverageQuote } from '@/hooks/useLeverageQuote';
import { useLeverageTransaction } from '@/hooks/useLeverageTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { LeverageSupport } from '@/hooks/leverage/types';
import type { Market, MarketPosition } from '@/utils/types';

type AddCollateralAndLeverageProps = {
  market: Market;
  support: LeverageSupport;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

const MULTIPLIER_INPUT_REGEX = /^\d*\.?\d*$/;

export function AddCollateralAndLeverage({
  market,
  support,
  currentPosition,
  collateralTokenBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: AddCollateralAndLeverageProps): JSX.Element {
  const route = support.route;
  const { address: account } = useConnection();
  const { usePermit2: usePermit2Setting } = useAppSettings();

  const [collateralAmount, setCollateralAmount] = useState<bigint>(0n);
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [multiplierInput, setMultiplierInput] = useState<string>(formatMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS));
  const [useLoanAssetInput, setUseLoanAssetInput] = useState(false);

  const multiplierBps = useMemo(() => clampMultiplierBps(parseMultiplierToBps(multiplierInput)), [multiplierInput]);
  const isErc4626Route = route?.kind === 'erc4626';

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

  useEffect(() => {
    // Underlying and collateral shares use different units. Reset amount when switching input source.
    setCollateralAmount(0n);
    setCollateralInputError(null);
  }, [useLoanAssetInput]);

  useEffect(() => {
    if (isErc4626Route) return;
    setUseLoanAssetInput(false);
  }, [isErc4626Route]);

  const {
    data: previewCollateralSharesFromUnderlying,
    isLoading: isLoadingUnderlyingToCollateralConversion,
    error: underlyingToCollateralConversionError,
  } = useReadContract({
    // WHY: for ERC4626 "start with loan asset" mode, user input is underlying assets.
    // We convert to collateral shares first so multiplier/flash math stays in collateral units.
    address: route?.collateralVault,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [collateralAmount],
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: isErc4626Route && useLoanAssetInput && collateralAmount > 0n,
    },
  });

  const collateralAmountForLeverageQuote = useMemo(() => {
    if (useLoanAssetInput) return (previewCollateralSharesFromUnderlying as bigint | undefined) ?? 0n;
    return collateralAmount;
  }, [useLoanAssetInput, previewCollateralSharesFromUnderlying, collateralAmount]);

  const conversionErrorMessage = useMemo(() => {
    if (!useLoanAssetInput || !underlyingToCollateralConversionError) return null;
    return underlyingToCollateralConversionError instanceof Error
      ? underlyingToCollateralConversionError.message
      : 'Failed to quote loan asset to collateral conversion.';
  }, [useLoanAssetInput, underlyingToCollateralConversionError]);

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
    // WHY: after a confirmed leverage tx, reset drafts so the panel reflects refreshed onchain position state.
    setCollateralAmount(0n);
    setCollateralInputError(null);
    setMultiplierInput(formatMultiplierBps(LEVERAGE_DEFAULT_MULTIPLIER_BPS));
    if (onSuccess) onSuccess();
  }, [onSuccess]);

  const { transaction, isLoadingPermit2, isApproved, permit2Authorized, leveragePending, approveAndLeverage, signAndLeverage } =
    useLeverageTransaction({
      market,
      route,
      collateralAmount,
      collateralAmountInCollateralToken: collateralAmountForLeverageQuote,
      flashCollateralAmount: quote.flashCollateralAmount,
      flashLoanAmount: quote.flashLoanAmount,
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
    if (usePermit2Setting && permit2Authorized) {
      void signAndLeverage();
      return;
    }
    if (!usePermit2Setting && isApproved) {
      void approveAndLeverage();
      return;
    }
    void approveAndLeverage();
  }, [usePermit2Setting, permit2Authorized, signAndLeverage, isApproved, approveAndLeverage]);

  const projectedOverLimit = projectedLTV >= lltv;
  const insufficientLiquidity = quote.flashLoanAmount > marketLiquidity;
  const hasChanges = collateralAmountForLeverageQuote > 0n && quote.flashLoanAmount > 0n;
  const inputAssetSymbol = useLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputAssetDecimals = useLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputAssetBalance = useLoanAssetInput ? (loanTokenBalance as bigint | undefined) : collateralTokenBalance;
  const inputTokenIconAddress = useLoanAssetInput ? market.loanAsset.address : market.collateralAsset.address;
  const isLoadingInputConversion = useLoanAssetInput && isLoadingUnderlyingToCollateralConversion;

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
                {isErc4626Route && (
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
                          {formatFullTokenAmount(quote.totalAddedCollateral, market.collateralAsset.decimals)}
                        </span>
                      }
                    >
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {formatCompactTokenAmount(quote.totalAddedCollateral, market.collateralAsset.decimals)}
                      </span>
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
                  (useLoanAssetInput && collateralAmountForLeverageQuote <= 0n) ||
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
