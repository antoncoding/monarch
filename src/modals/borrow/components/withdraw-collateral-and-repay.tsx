import { useMemo, useState, useEffect, useCallback } from 'react';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { IconSwitch } from '@/components/ui/icon-switch';
import Input from '@/components/Input/Input';
import { useRepayTransaction } from '@/hooks/useRepayTransaction';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import type { Market, MarketPosition } from '@/utils/types';
import { MarketDetailsBlock } from '@/features/markets/components/market-details-block';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { TokenIcon } from '@/components/shared/token-icon';
import { BorrowPositionRiskCard } from './borrow-position-risk-card';
import {
  clampTargetLtv,
  computeLtv,
  computeTargetRepayAmount,
  computeTargetWithdrawAmount,
  ltvWadToPercent,
  percentToLtvWad,
} from './helpers';

type WithdrawCollateralAndRepayProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  loanTokenBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

export function WithdrawCollateralAndRepay({
  market,
  currentPosition,
  loanTokenBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: WithdrawCollateralAndRepayProps): JSX.Element {
  const { usePermit2: usePermit2Setting } = useAppSettings();

  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(0n);
  const [repayAssets, setRepayAssets] = useState<bigint>(0n);
  const [repayShares, setRepayShares] = useState<bigint>(0n);
  const [showLtvInput, setShowLtvInput] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'withdraw' | 'repay'>('repay');
  const [ltvInput, setLtvInput] = useState<string>('0');
  const [isEditingLtvInput, setIsEditingLtvInput] = useState(false);
  const [withdrawInputError, setWithdrawInputError] = useState<string | null>(null);
  const [repayInputError, setRepayInputError] = useState<string | null>(null);

  const lltv = BigInt(market.lltv);
  const currentCollateralAssets = BigInt(currentPosition?.state.collateral ?? 0);
  const currentBorrowAssets = BigInt(currentPosition?.state.borrowAssets ?? 0);
  const maxWithdrawAssets = currentCollateralAssets;
  const hasChanges = withdrawAmount > 0n || repayAssets > 0n;

  const { isLoadingPermit2, isApproved, permit2Authorized, repayPending, approveAndRepay, signAndRepay } = useRepayTransaction({
    market,
    currentPosition,
    withdrawAmount,
    repayAssets,
    repayShares,
    onSuccess,
  });

  const handleRepay = useCallback(() => {
    const needsRepay = repayAssets > 0n || repayShares > 0n;
    if (needsRepay && (!permit2Authorized || (!usePermit2Setting && !isApproved))) {
      void approveAndRepay();
    } else {
      void signAndRepay();
    }
  }, [repayAssets, repayShares, permit2Authorized, usePermit2Setting, isApproved, approveAndRepay, signAndRepay]);

  const buttonLabel = useMemo(() => {
    const needsRepay = repayAssets > 0n || repayShares > 0n;
    if (needsRepay && !isApproved && !permit2Authorized) {
      return 'Approve & Repay';
    }
    if (withdrawAmount > 0n && needsRepay) {
      return 'Withdraw & Repay';
    }
    if (withdrawAmount > 0n) {
      return 'Withdraw';
    }
    return 'Repay';
  }, [repayAssets, repayShares, isApproved, permit2Authorized, withdrawAmount]);

  const setShareToMax = useCallback(() => {
    if (currentPosition) {
      setRepayShares(BigInt(currentPosition.state.borrowShares));
    }
    setLastEditedField('repay');
  }, [currentPosition]);

  const maxToRepay = useMemo(
    () =>
      BigInt(currentPosition?.state.borrowAssets ?? 0) > BigInt(loanTokenBalance ?? 0)
        ? BigInt(loanTokenBalance ?? 0)
        : BigInt(currentPosition?.state.borrowAssets ?? 0),
    [loanTokenBalance, currentPosition],
  );

  const projectedCollateralAssets = useMemo(() => {
    if (withdrawAmount >= currentCollateralAssets) return 0n;
    return currentCollateralAssets - withdrawAmount;
  }, [withdrawAmount, currentCollateralAssets]);

  const projectedBorrowAssets = useMemo(() => {
    if (repayAssets >= currentBorrowAssets) return 0n;
    return currentBorrowAssets - repayAssets;
  }, [repayAssets, currentBorrowAssets]);

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
        borrowAssets: projectedBorrowAssets,
        collateralAssets: projectedCollateralAssets,
        oraclePrice,
      }),
    [projectedBorrowAssets, projectedCollateralAssets, oraclePrice],
  );

  const maxTargetLtvPercent = useMemo(() => Math.min(100, ltvWadToPercent(clampTargetLtv(lltv, lltv))), [lltv]);

  const formatEditablePercent = useCallback(
    (value: number) => {
      const clamped = Math.max(0, Math.min(value, maxTargetLtvPercent));
      if (Number.isInteger(clamped)) return clamped.toString();
      return clamped.toFixed(2).replace(/\.?0+$/, '');
    },
    [maxTargetLtvPercent],
  );

  useEffect(() => {
    if (isEditingLtvInput) return;
    setLtvInput(formatEditablePercent(ltvWadToPercent(projectedLTV)));
  }, [projectedLTV, formatEditablePercent, isEditingLtvInput]);

  const handleRefresh = useCallback(() => {
    if (!onSuccess) return;
    try {
      onSuccess();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [onSuccess]);

  const handleWithdrawAmountChange = useCallback(
    (value: bigint) => {
      setLastEditedField('withdraw');
      setWithdrawAmount(value);
    },
    [],
  );

  const handleRepayAmountChange = useCallback(
    (value: bigint) => {
      setLastEditedField('repay');
      setRepayAssets(value);
      setRepayShares(0n);
    },
    [],
  );

  const handleLtvInputChange = useCallback(
    (value: string) => {
      const normalizedInput = value.replace(',', '.');
      if (normalizedInput === '') {
        setLtvInput('');
        return;
      }
      if (!/^\d*\.?\d*$/.test(normalizedInput)) return;
      setLtvInput(normalizedInput);

      const parsedPercent = Number.parseFloat(normalizedInput);
      if (!Number.isFinite(parsedPercent)) return;
      const clampedPercent = Math.max(0, Math.min(parsedPercent, maxTargetLtvPercent));
      if (clampedPercent !== parsedPercent) {
        setLtvInput(formatEditablePercent(clampedPercent));
      }

      const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
      if (clampedTargetLtv <= 0n) return;

      if (lastEditedField === 'repay') {
        const borrowAssetsAfterRepay = repayAssets >= currentBorrowAssets ? 0n : currentBorrowAssets - repayAssets;
        const nextWithdrawAmount = computeTargetWithdrawAmount({
          currentCollateralAssets,
          borrowAssetsAfterRepay,
          oraclePrice,
          targetLtv: clampedTargetLtv,
        });
        setWithdrawAmount(nextWithdrawAmount);
        setWithdrawInputError(nextWithdrawAmount > maxWithdrawAssets ? 'Exceeds current collateral' : null);
        return;
      }

      const nextRepayAssets = computeTargetRepayAmount({
        currentBorrowAssets,
        projectedCollateralAssets,
        oraclePrice,
        targetLtv: clampedTargetLtv,
      });
      setRepayAssets(nextRepayAssets);
      setRepayShares(0n);
      setRepayInputError(nextRepayAssets > maxToRepay ? 'Exceeds current debt or insufficient balance' : null);
    },
    [
      lltv,
      lastEditedField,
      repayAssets,
      currentBorrowAssets,
      currentCollateralAssets,
      oraclePrice,
      maxWithdrawAssets,
      projectedCollateralAssets,
      maxToRepay,
      maxTargetLtvPercent,
      formatEditablePercent,
    ],
  );

  const handleLtvInputBlur = useCallback(() => {
    setIsEditingLtvInput(false);
    const parsedPercent = Number.parseFloat(ltvInput.replace(',', '.'));
    if (!Number.isFinite(parsedPercent)) {
      setLtvInput(formatEditablePercent(ltvWadToPercent(projectedLTV)));
      return;
    }
    const clampedPercent = Math.max(0, Math.min(parsedPercent, maxTargetLtvPercent));
    const clampedTargetLtv = clampTargetLtv(percentToLtvWad(clampedPercent), lltv);
    setLtvInput(formatEditablePercent(ltvWadToPercent(clampedTargetLtv)));
  }, [ltvInput, projectedLTV, lltv, maxTargetLtvPercent, formatEditablePercent]);
  const amountInputClassName = 'h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums';
  const ltvInputClassName =
    'h-10 w-full rounded bg-hovered p-2 pr-8 text-base font-medium tabular-nums focus:border-primary focus:outline-none';

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      <div className="flex flex-col">
        <BorrowPositionRiskCard
          market={market}
          currentCollateral={currentCollateralAssets}
          currentBorrow={currentBorrowAssets}
          currentLtv={currentLTV}
          projectedLtv={projectedLTV}
          lltv={lltv}
          onRefresh={onSuccess ? handleRefresh : undefined}
          isRefreshing={isRefreshing}
          borrowLabel="Outstanding Debt"
          hasChanges={hasChanges}
        />

        <div className="mb-5">
          <MarketDetailsBlock
            market={market}
            mode="borrow"
            defaultCollapsed
            borrowDelta={repayAssets ? -repayAssets : undefined}
          />
        </div>

        <div className="mt-5 space-y-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p className="font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Manage Position</p>
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

          <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
            <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">
              Withdraw {market.collateralAsset.symbol}
            </p>
            <Input
              decimals={market.collateralAsset.decimals}
              max={maxWithdrawAssets}
              setValue={handleWithdrawAmountChange}
              setError={setWithdrawInputError}
              exceedMaxErrMessage="Exceeds current collateral"
              value={withdrawAmount}
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
              Available: {formatBalance(maxWithdrawAssets, market.collateralAsset.decimals)} {market.collateralAsset.symbol}
            </p>
            {withdrawInputError && <p className="mt-1 text-right text-xs text-red-500">{withdrawInputError}</p>}
          </div>

          <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
            <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Repay {market.loanAsset.symbol}</p>
            <Input
              decimals={market.loanAsset.decimals}
              max={maxToRepay}
              setValue={handleRepayAmountChange}
              setError={setRepayInputError}
              exceedMaxErrMessage="Exceeds current debt or insufficient balance"
              onMaxClick={setShareToMax}
              value={repayAssets}
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
              Debt: {formatBalance(maxToRepay, market.loanAsset.decimals)} {market.loanAsset.symbol}
            </p>
            {repayInputError && <p className="mt-1 text-right text-xs text-red-500">{repayInputError}</p>}
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
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4">
          <div
            className="flex justify-end"
            style={{ zIndex: 1 }}
          >
            <ExecuteTransactionButton
              targetChainId={market.morphoBlue.chain.id}
              onClick={handleRepay}
              isLoading={repayPending || isLoadingPermit2}
              disabled={
                withdrawInputError !== null ||
                repayInputError !== null ||
                (withdrawAmount === 0n && repayAssets === 0n) ||
                projectedLTV >= lltv
              }
              variant="primary"
              className="min-w-32"
            >
              {buttonLabel}
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
    </div>
  );
}
