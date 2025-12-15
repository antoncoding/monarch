import { useMemo, useState, useEffect, useCallback } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { LTVWarning } from '@/components/common/LTVWarning';
import Input from '@/components/Input/Input';
import { RepayProcessModal } from '@/components/RepayProcessModal';
import { useRepayTransaction } from '@/hooks/useRepayTransaction';
import { formatBalance } from '@/utils/balance';
import type { Market, MarketPosition } from '@/utils/types';
import { MarketDetailsBlock } from '../common/MarketDetailsBlock';
import { TokenIcon } from '../TokenIcon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { getLTVColor, getLTVProgressColor } from './helpers';

type WithdrawCollateralAndRepayProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  loanTokenBalance: bigint | undefined;
  collateralTokenBalance: bigint | undefined;
  ethBalance: bigint | undefined;
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
  // State for withdraw and repay amounts
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));

  const [repayAssets, setRepayAssets] = useState<bigint>(BigInt(0));

  // Only specified when click on "max" button. If set, the contract specify exactly how much shares to repay
  const [repayShares, setRepayShares] = useState<bigint>(BigInt(0));

  const [withdrawInputError, setWithdrawInputError] = useState<string | null>(null);
  const [repayInputError, setRepayInputError] = useState<string | null>(null);

  // lltv with 18 decimals
  const lltv = BigInt(market.lltv);

  // Calculate current and new LTV
  const [currentLTV, setCurrentLTV] = useState<bigint>(BigInt(0));
  const [newLTV, setNewLTV] = useState<bigint>(BigInt(0));

  // Use the repay transaction hook
  const {
    currentStep,
    showProcessModal,
    setShowProcessModal,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    repayPending,
    approveAndRepay,
    signAndRepay,
  } = useRepayTransaction({
    market,
    currentPosition,
    withdrawAmount,
    repayAssets,
    repayShares,
    onSuccess,
  });

  const handleRepay = useCallback(() => {
    if (!isApproved && !permit2Authorized) {
      void approveAndRepay();
    } else {
      void signAndRepay();
    }
  }, [isApproved, permit2Authorized, approveAndRepay, signAndRepay]);

  // if max is clicked, set the repayShares to max shares
  const setShareToMax = useCallback(() => {
    if (currentPosition) {
      setRepayShares(BigInt(currentPosition.state.borrowShares));
    }
  }, [currentPosition]);

  // if number changes, and it's not max, set the repayAssets to corresponding amount
  useEffect(() => {
    if (repayAssets !== BigInt(currentPosition?.state.borrowAssets || 0)) {
      setRepayShares(BigInt(0));
    }
  }, [repayAssets, currentPosition]);

  const maxToRepay = useMemo(
    () =>
      BigInt(currentPosition?.state.borrowAssets ?? 0) > BigInt(loanTokenBalance ?? 0)
        ? BigInt(loanTokenBalance ?? 0)
        : BigInt(currentPosition?.state.borrowAssets ?? 0),
    [loanTokenBalance, currentPosition],
  );

  // Calculate current and new LTV whenever relevant values change
  useEffect(() => {
    if (currentPosition) {
      // Calculate current LTV from position data using oracle price
      const currentCollateralValue = (BigInt(currentPosition.state.collateral) * oraclePrice) / BigInt(10 ** 36);
      const currentBorrowValue = BigInt(currentPosition.state.borrowAssets || 0);

      if (currentCollateralValue > 0) {
        const ltv = (currentBorrowValue * BigInt(10 ** 18)) / currentCollateralValue;
        setCurrentLTV(ltv);
      } else {
        setCurrentLTV(BigInt(0));
      }
    } else {
      setCurrentLTV(BigInt(0));
    }
  }, [currentPosition, oraclePrice]);

  useEffect(() => {
    if (!currentPosition) return;

    // Calculate new LTV based on current position minus withdraw/repay amounts using oracle price
    const newCollateral = BigInt(currentPosition.state.collateral) - withdrawAmount;
    const newBorrow = BigInt(currentPosition.state.borrowAssets || 0) - repayAssets;

    const newCollateralValueInLoan = (newCollateral * oraclePrice) / BigInt(10 ** 36);

    if (newCollateralValueInLoan > 0) {
      const ltv = (newBorrow * BigInt(10 ** 18)) / newCollateralValueInLoan;
      setNewLTV(ltv);
    } else {
      setNewLTV(BigInt(0));
    }
  }, [currentPosition, withdrawAmount, repayAssets, oraclePrice]);

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    if (!onSuccess) return;
    try {
      onSuccess();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [onSuccess]);

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      <div className="flex flex-col">
        {/* Position Overview Box with dynamic LTV */}
        <div className="bg-hovered mb-5 rounded-sm p-4">
          <div className="mb-3 flex items-center justify-between font-zen text-base">
            <span>My Borrow</span>
            {onSuccess && (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="rounded-full p-1 transition-opacity hover:opacity-70"
                disabled={isRefreshing}
                aria-label="Refresh position data"
              >
                <ReloadIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Current Position Stats */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 font-zen text-xs opacity-50">Total Collateral</p>
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.collateralAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.collateralAsset.symbol}
                  width={16}
                  height={16}
                />
                <p className="font-zen text-sm">
                  {formatBalance(BigInt(currentPosition?.state.collateral ?? 0), market.collateralAsset.decimals)}{' '}
                  {market.collateralAsset.symbol}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-1 font-zen text-xs opacity-50">Total Borrowed</p>
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={16}
                  height={16}
                />
                <p className="font-zen text-sm">
                  {formatBalance(BigInt(currentPosition?.state.borrowAssets ?? 0), market.loanAsset.decimals)} {market.loanAsset.symbol}
                </p>
              </div>
            </div>
          </div>

          {/* LTV Indicator - Shows both current and projected */}
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
              <div className="font-zen text-sm">
                {withdrawAmount > 0n || repayAssets > 0n ? (
                  <>
                    <span className="text-gray-400 line-through">{formatBalance(currentLTV, 16).toPrecision(4)}%</span>
                    <span className={`ml-2 ${getLTVColor(newLTV, lltv)}`}>{formatBalance(newLTV, 16).toPrecision(4)}%</span>
                  </>
                ) : (
                  <span className={getLTVColor(currentLTV, lltv)}>{formatBalance(currentLTV, 16).toPrecision(4)}%</span>
                )}
              </div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className={`h-2 rounded-full transition-all duration-500 ease-in-out ${getLTVProgressColor(
                  withdrawAmount > 0 || repayAssets > 0 ? newLTV : currentLTV,
                  lltv,
                )}`}
                style={{
                  width: `${Math.min(100, (Number(withdrawAmount > 0 || repayAssets > 0 ? newLTV : currentLTV) / Number(lltv)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <p className="font-zen text-xs text-secondary">Max LTV: {formatBalance(lltv, 16)}%</p>
            </div>
          </div>
        </div>

        {/* Market Details Block - includes position overview and collapsible details */}
        <div className="mb-5">
          <MarketDetailsBlock
            market={market}
            mode="borrow"
            defaultCollapsed
            borrowDelta={repayAssets ? -repayAssets : undefined}
          />
        </div>

        <div className="mt-12 space-y-4">
          {/* Withdraw Input Section */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <p className="font-inter text-sm">Withdraw Collateral</p>
              <p className="font-inter text-xs opacity-50">
                Available: {formatBalance(BigInt(currentPosition?.state.collateral ?? 0), market.collateralAsset.decimals)}{' '}
                {market.collateralAsset.symbol}
              </p>
            </div>

            <div className="mb-4 flex items-start justify-between">
              <div className="relative flex-grow">
                <Input
                  decimals={market.collateralAsset.decimals}
                  max={BigInt(currentPosition?.state.collateral ?? 0)}
                  setValue={setWithdrawAmount}
                  setError={setWithdrawInputError}
                  exceedMaxErrMessage="Exceeds current collateral"
                />
                {withdrawInputError && <p className="p-1 text-sm text-red-500">{withdrawInputError}</p>}
              </div>
            </div>
          </div>

          {/* Repay Input Section */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <p className="font-inter text-sm">Repay Loan</p>
              <p className="font-inter text-xs opacity-50">
                Debt: {formatBalance(BigInt(currentPosition?.state.borrowAssets ?? 0), market.loanAsset.decimals)} {market.loanAsset.symbol}
              </p>
            </div>

            <div className="mb-4 flex items-start justify-between">
              <div className="relative flex-grow">
                <Input
                  decimals={market.loanAsset.decimals}
                  max={maxToRepay}
                  setValue={setRepayAssets}
                  setError={setRepayInputError}
                  exceedMaxErrMessage="Exceeds current debt or insufficient balance"
                  onMaxClick={setShareToMax}
                />
                {repayInputError && <p className="p-1 text-sm text-red-500">{repayInputError}</p>}
              </div>
            </div>
          </div>
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
                (withdrawAmount === BigInt(0) && repayAssets === BigInt(0)) ||
                newLTV >= lltv
              }
              variant="primary"
              className="min-w-32"
            >
              {!isApproved && !permit2Authorized ? 'Approve & Repay' : withdrawAmount > 0 ? 'Withdraw & Repay' : 'Repay'}
            </ExecuteTransactionButton>
          </div>
          {(withdrawAmount > 0n || repayAssets > 0n) && (
            <>
              {newLTV >= lltv && (
                <LTVWarning
                  maxLTV={lltv}
                  currentLTV={newLTV}
                  type="error"
                />
              )}
              {newLTV < lltv && newLTV >= (lltv * 90n) / 100n && (
                <LTVWarning
                  maxLTV={lltv}
                  currentLTV={newLTV}
                  type="danger"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Process Modal */}
      {showProcessModal && (
        <RepayProcessModal
          market={market}
          repayAmount={repayAssets}
          withdrawAmount={withdrawAmount}
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          tokenSymbol={market.loanAsset.symbol}
          usePermit2
        />
      )}
    </div>
  );
}
