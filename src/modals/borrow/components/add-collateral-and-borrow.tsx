import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuDroplets } from 'react-icons/lu';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Tooltip } from '@/components/ui/tooltip';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { MarketDetailsBlock } from '@/features/markets/components/market-details-block';
import Input from '@/components/Input/Input';
import { useBorrowTransaction } from '@/hooks/useBorrowTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getNativeTokenSymbol } from '@/utils/networks';
import { isWrappedNativeToken } from '@/utils/tokens';
import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { TokenIcon } from '@/components/shared/token-icon';
import { BorrowPositionRiskCard } from './borrow-position-risk-card';
import {
  LTV_WAD,
  clampEditablePercent,
  clampTargetLtv,
  computeLtv,
  computeTargetCollateralAmount,
  formatEditableLtvPercent,
  formatLtvPercent,
  getCollateralValueInLoan,
  ltvWadToPercent,
  normalizeEditablePercentInput,
  percentToLtvWad,
} from './helpers';

type BorrowLogicProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  ethBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
  liquiditySourcing?: LiquiditySourcingResult;
};

export function AddCollateralAndBorrow({
  market,
  currentPosition,
  collateralTokenBalance,
  ethBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
  liquiditySourcing,
}: BorrowLogicProps): JSX.Element {
  const [collateralAmount, setCollateralAmount] = useState<bigint>(0n);
  const [borrowAmount, setBorrowAmount] = useState<bigint>(0n);
  const [showLtvInput, setShowLtvInput] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'collateral' | 'borrow'>('borrow');
  const [ltvInput, setLtvInput] = useState<string>('0');
  const [isEditingLtvInput, setIsEditingLtvInput] = useState(false);
  const [ltvBorrowHint, setLtvBorrowHint] = useState<string | null>(null);
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [borrowInputError, setBorrowInputError] = useState<string | null>(null);
  const { usePermit2: usePermit2Setting } = useAppSettings();

  const lltv = BigInt(market.lltv);
  const currentCollateralAssets = BigInt(currentPosition?.state.collateral ?? 0);
  const currentBorrowAssets = BigInt(currentPosition?.state.borrowAssets ?? 0);
  const projectedCollateralAssets = currentCollateralAssets + collateralAmount;
  const hasChanges = collateralAmount > 0n || borrowAmount > 0n;

  const extraLiquidity = liquiditySourcing?.totalAvailableExtraLiquidity ?? 0n;
  const marketLiquidity = BigInt(market.state.liquidityAssets);
  const effectiveAvailableLiquidity = marketLiquidity + extraLiquidity;

  // Use the new hook for borrow transaction logic
  const {
    transaction,
    useEth,
    setUseEth,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    borrowPending,
    approveAndBorrow,
    signAndBorrow,
  } = useBorrowTransaction({
    market,
    collateralAmount,
    borrowAmount,
    onSuccess,
    liquiditySourcing,
  });

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
        borrowAssets: currentBorrowAssets + borrowAmount,
        collateralAssets: projectedCollateralAssets,
        oraclePrice,
      }),
    [currentBorrowAssets, borrowAmount, projectedCollateralAssets, oraclePrice],
  );

  const maxTargetLtvPercent = useMemo(() => Math.min(100, ltvWadToPercent(clampTargetLtv(lltv, lltv))), [lltv]);

  useEffect(() => {
    if (isEditingLtvInput) return;
    setLtvInput(formatEditableLtvPercent(ltvWadToPercent(projectedLTV), maxTargetLtvPercent));
  }, [projectedLTV, maxTargetLtvPercent, isEditingLtvInput]);

  useEffect(() => {
    if (!showLtvInput) {
      setLtvBorrowHint(null);
      return;
    }
    if (!hasChanges) {
      setLastEditedField('collateral');
    }
  }, [showLtvInput, hasChanges]);

  const handleBorrow = useCallback(() => {
    if ((!permit2Authorized && !useEth) || (!usePermit2Setting && !isApproved)) {
      void approveAndBorrow();
    } else {
      void signAndBorrow();
    }
  }, [permit2Authorized, useEth, usePermit2Setting, isApproved, approveAndBorrow, signAndBorrow]);

  const handleRefresh = useCallback(() => {
    if (!onSuccess) return;
    try {
      onSuccess();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [onSuccess]);

  const handleCollateralAmountChange = useCallback((value: bigint) => {
    setLastEditedField('collateral');
    setLtvBorrowHint(null);
    setCollateralAmount(value);
  }, []);

  const handleBorrowAmountChange = useCallback((value: bigint) => {
    setLastEditedField('borrow');
    setLtvBorrowHint(null);
    setBorrowAmount(value);
  }, []);

  const handleLtvInputChange = useCallback(
    (value: string) => {
      const normalizedInput = normalizeEditablePercentInput(value);
      if (normalizedInput == null) return;
      setLtvInput(normalizedInput);
      setLtvBorrowHint(null);
      if (normalizedInput === '') return;

      const parsedPercent = Number.parseFloat(normalizedInput);
      if (!Number.isFinite(parsedPercent)) return;
      const clampedPercent = clampEditablePercent(parsedPercent, maxTargetLtvPercent);

      const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
      if (clampedTargetLtv <= 0n) return;

      if (lastEditedField === 'borrow') {
        const nextCollateralAmount = computeTargetCollateralAmount({
          totalBorrowAssets: currentBorrowAssets + borrowAmount,
          currentCollateralAssets,
          oraclePrice,
          targetLtv: clampedTargetLtv,
        });
        const maxCollateralInput = useEth ? (ethBalance ?? 0n) : (collateralTokenBalance ?? 0n);
        setCollateralAmount(nextCollateralAmount);
        setCollateralInputError(nextCollateralAmount > maxCollateralInput ? 'Insufficient Balance' : null);
        return;
      }

      if (lastEditedField === 'collateral') {
        const collateralValueInLoan = getCollateralValueInLoan(projectedCollateralAssets, oraclePrice);
        const targetBorrowTotal = (collateralValueInLoan * clampedTargetLtv) / LTV_WAD;
        const signedBorrowDelta = targetBorrowTotal - currentBorrowAssets;

        if (signedBorrowDelta <= 0n) {
          setBorrowAmount(0n);
          setBorrowInputError(null);
          setLtvBorrowHint('Set a target LTV above current to preview borrow amount.');
          return;
        }
        setBorrowAmount(signedBorrowDelta);
        setBorrowInputError(signedBorrowDelta > effectiveAvailableLiquidity ? 'Exceeds available liquidity' : null);
        return;
      }

      setLtvBorrowHint(null);
    },
    [
      lltv,
      lastEditedField,
      currentBorrowAssets,
      borrowAmount,
      currentCollateralAssets,
      oraclePrice,
      useEth,
      ethBalance,
      collateralTokenBalance,
      projectedCollateralAssets,
      effectiveAvailableLiquidity,
      maxTargetLtvPercent,
    ],
  );

  const handleLtvInputBlur = useCallback(() => {
    setIsEditingLtvInput(false);
    const parsedPercent = Number.parseFloat(ltvInput.replace(',', '.'));
    if (!Number.isFinite(parsedPercent)) {
      setLtvInput(formatEditableLtvPercent(ltvWadToPercent(projectedLTV), maxTargetLtvPercent));
      return;
    }
    const clampedPercent = clampEditablePercent(parsedPercent, maxTargetLtvPercent);
    const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
    setLtvInput(formatEditableLtvPercent(ltvWadToPercent(clampedTargetLtv), maxTargetLtvPercent));
  }, [ltvInput, projectedLTV, lltv, maxTargetLtvPercent]);
  const amountInputClassName = 'h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums';
  const ltvInputClassName =
    'h-10 w-full rounded bg-hovered p-2 pr-8 text-base font-medium tabular-nums focus:border-primary focus:outline-none';

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">My Position</p>
          <BorrowPositionRiskCard
            market={market}
            currentCollateral={currentCollateralAssets}
            currentBorrow={currentBorrowAssets}
            currentLtv={currentLTV}
            projectedLtv={projectedLTV}
            lltv={lltv}
            onRefresh={onSuccess ? handleRefresh : undefined}
            isRefreshing={isRefreshing}
            hasChanges={hasChanges}
          />

          <div className="mb-5">
            <MarketDetailsBlock
              market={market}
              mode="borrow"
              defaultCollapsed
              showRewards
              borrowDelta={borrowAmount}
              extraLiquidity={extraLiquidity}
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <p className="font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Borrow More</p>
              <div className="flex items-center gap-3">
                {isWrappedNativeToken(market.collateralAsset.address, market.morphoBlue.chain.id) && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-secondary">Use {getNativeTokenSymbol(market.morphoBlue.chain.id)}</div>
                    <IconSwitch
                      size="sm"
                      selected={useEth}
                      onChange={setUseEth}
                      thumbIcon={null}
                      classNames={{
                        wrapper: 'w-9 h-4 mr-0',
                        thumb: 'w-3 h-3',
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-secondary">Set Target LTV</div>
                  <IconSwitch
                    size="sm"
                    selected={showLtvInput}
                    onChange={setShowLtvInput}
                    thumbIcon={null}
                    classNames={{
                      wrapper: 'w-9 h-4 mr-0',
                      thumb: 'w-3 h-3',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
                Add Collateral {useEth ? getNativeTokenSymbol(market.morphoBlue.chain.id) : market.collateralAsset.symbol}
              </p>
              <Input
                decimals={market.collateralAsset.decimals}
                max={useEth ? ethBalance : collateralTokenBalance}
                setValue={handleCollateralAmountChange}
                setError={setCollateralInputError}
                exceedMaxErrMessage="Insufficient Balance"
                value={collateralAmount}
                inputClassName={amountInputClassName}
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
              <p className="mt-1 text-right text-xs text-secondary">
                Balance:{' '}
                {formatBalance(useEth ? (ethBalance ?? 0n) : (collateralTokenBalance ?? 0n), useEth ? 18 : market.collateralAsset.decimals)}{' '}
                {useEth ? getNativeTokenSymbol(market.morphoBlue.chain.id) : market.collateralAsset.symbol}
              </p>
              {collateralInputError && <p className="mt-1 text-right text-xs text-red-500">{collateralInputError}</p>}
            </div>

            <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
              <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Borrow {market.loanAsset.symbol}</p>
              <Input
                decimals={market.loanAsset.decimals}
                setValue={handleBorrowAmountChange}
                setError={setBorrowInputError}
                exceedMaxErrMessage="Exceeds available liquidity"
                value={borrowAmount}
                max={effectiveAvailableLiquidity}
                inputClassName={amountInputClassName}
                endAdornment={
                  <TokenIcon
                    address={market.loanAsset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={market.loanAsset.symbol}
                    width={16}
                    height={16}
                  />
                }
              />
              <p className="mt-1 text-right text-xs text-secondary">
                Available: {formatReadable(formatBalance(effectiveAvailableLiquidity, market.loanAsset.decimals))} {market.loanAsset.symbol}
                {extraLiquidity > 0n && (
                  <Tooltip
                    content="Includes extra liquidity sourced from Public Allocator vaults"
                    className="z-[2000]"
                  >
                    <span className="ml-1 inline-flex">
                      <LuDroplets className="h-3 w-3" />
                    </span>
                  </Tooltip>
                )}
              </p>
              {borrowInputError && <p className="mt-1 text-right text-xs text-red-500">{borrowInputError}</p>}
              {borrowAmount > marketLiquidity && borrowAmount <= effectiveAvailableLiquidity && liquiditySourcing?.canSourceLiquidity && (
                <p className="mt-1 text-right text-xs text-blue-500">⚡ Sourcing extra liquidity via Public Allocator</p>
              )}
            </div>

            {showLtvInput && (
              <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
                <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Target LTV</p>
                <div className="relative min-w-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    min={0}
                    max={maxTargetLtvPercent}
                    step={0.01}
                    value={ltvInput}
                    onFocus={() => setIsEditingLtvInput(true)}
                    onChange={(event) => handleLtvInputChange(event.target.value)}
                    onBlur={handleLtvInputBlur}
                    className={ltvInputClassName}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">%</span>
                </div>
                {ltvBorrowHint && lastEditedField === 'collateral' && (
                  <button
                    type="button"
                    onClick={() =>
                      handleLtvInputChange(
                        formatEditableLtvPercent(Math.min(maxTargetLtvPercent, ltvWadToPercent(currentLTV) + 1), maxTargetLtvPercent),
                      )
                    }
                    className="mt-2 inline-flex text-left text-xs text-secondary hover:text-primary"
                  >
                    {ltvBorrowHint} (Current {formatLtvPercent(currentLTV)}%)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-4">
            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleBorrow}
                isLoading={isLoadingPermit2 || borrowPending}
                disabled={
                  collateralInputError !== null ||
                  borrowInputError !== null ||
                  (collateralAmount === 0n && borrowAmount === 0n) ||
                  projectedLTV >= lltv
                }
                variant="primary"
                className="min-w-32"
              >
                {collateralAmount > 0n && borrowAmount === 0n ? 'Add Collateral' : 'Borrow'}
              </ExecuteTransactionButton>
            </div>
            {hasChanges && (
              <>
                {projectedLTV >= lltv && (
                  <LTVWarning
                    maxLTV={lltv}
                    currentLTV={projectedLTV}
                    type="error"
                  />
                )}
                {projectedLTV < lltv && projectedLTV >= (lltv * 90n) / 100n && (
                  <LTVWarning
                    maxLTV={lltv}
                    currentLTV={projectedLTV}
                    type="danger"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
