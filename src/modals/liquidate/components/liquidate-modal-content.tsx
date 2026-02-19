import { useState, useCallback } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import Input from '@/components/Input/Input';
import { useLiquidateTransaction } from '@/hooks/useLiquidateTransaction';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { Market } from '@/utils/types';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { AccountIdentity } from '@/components/shared/account-identity';
import type { Address } from 'viem';

type LiquidateModalContentProps = {
  market: Market;
  borrower: Address;
  borrowerCollateral: bigint;
  borrowerBorrowShares: bigint;
  onSuccess?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
};

export function LiquidateModalContent({
  market,
  borrower,
  borrowerCollateral,
  borrowerBorrowShares,
  onSuccess,
  onRefresh,
  isLoading,
}: LiquidateModalContentProps): JSX.Element {
  const [repayAmount, setRepayAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [useMaxShares, setUseMaxShares] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Convert borrow shares to assets for display
  const totalBorrowAssets = BigInt(market.state.borrowAssets);
  const totalBorrowShares = BigInt(market.state.borrowShares);
  const borrowerDebtInAssets =
    totalBorrowShares > 0n && borrowerBorrowShares > 0n ? (borrowerBorrowShares * totalBorrowAssets) / totalBorrowShares : 0n;

  // Calculate USD values
  const borrowerDebtUsd =
    totalBorrowAssets > 0n && market.state.borrowAssetsUsd > 0
      ? (Number(borrowerDebtInAssets) / Number(totalBorrowAssets)) * market.state.borrowAssetsUsd
      : 0;

  const borrowerCollateralUsd =
    borrowerCollateral > 0n && market.state.collateralAssetsUsd != null && Number(market.state.collateralAssets) > 0
      ? (Number(borrowerCollateral) / Number(market.state.collateralAssets)) * (market.state.collateralAssetsUsd ?? 0)
      : 0;

  // seizedAssets is in collateral token units
  // When useMaxShares is true, we repay full debt (shares) and protocol calculates collateral
  const seizedAssets = useMaxShares ? BigInt(0) : repayAmount;
  const repaidShares = useMaxShares ? borrowerBorrowShares : BigInt(0);

  // Calculate loan token amount for approval
  // Convert collateral to loan token equivalent using USD values
  let loanAmountForApproval: bigint;
  if (useMaxShares) {
    // Max: approve the full debt amount in loan tokens
    loanAmountForApproval = borrowerDebtInAssets;
  } else if (
    seizedAssets > 0n &&
    market.state.collateralAssetsUsd != null &&
    market.state.borrowAssetsUsd > 0 &&
    Number(market.state.collateralAssets) > 0 &&
    Number(market.state.borrowAssets) > 0
  ) {
    // Convert collateral amount to loan token amount using USD exchange rate
    const collateralUsdPerToken = market.state.collateralAssetsUsd / Number(market.state.collateralAssets);
    const loanUsdPerToken = market.state.borrowAssetsUsd / Number(market.state.borrowAssets);
    const collateralUsd = Number(seizedAssets) * collateralUsdPerToken;
    const loanTokens = collateralUsd / loanUsdPerToken;
    loanAmountForApproval = BigInt(Math.floor(loanTokens * 10 ** market.loanAsset.decimals));
  } else {
    loanAmountForApproval = 0n;
  }

  const { liquidatePending, handleLiquidate } = useLiquidateTransaction({
    market,
    borrower,
    seizedAssets,
    repaidShares,
    repayAmount: loanAmountForApproval,
    onSuccess,
  });

  const handleMaxClick = useCallback(() => {
    setUseMaxShares(true);
    setRepayAmount(borrowerCollateral);
  }, [borrowerCollateral]);

  const handleInputChange = useCallback((value: bigint) => {
    setRepayAmount(value);
    setUseMaxShares(false);
    setInputError(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [onRefresh]);

  const isValid = repayAmount > 0n || useMaxShares;
  const hasBorrowPosition = borrowerBorrowShares > 0n;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm bg-hovered p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs uppercase text-secondary">Borrower</div>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full p-1 transition-opacity hover:opacity-70"
              disabled={isRefreshing}
              aria-label="Refresh borrower data"
            >
              <RefetchIcon
                isLoading={isRefreshing}
                className="h-4 w-4"
              />
            </button>
          )}
        </div>
        <AccountIdentity
          address={borrower}
          chainId={market.morphoBlue.chain.id}
          variant="compact"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm bg-hovered p-3">
          <div className="font-zen text-xs uppercase text-secondary">Debt</div>
          <div className="mt-1 flex items-center gap-1">
            <span className="font-zen text-sm">{formatReadable(formatBalance(borrowerDebtInAssets, market.loanAsset.decimals))}</span>
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            {borrowerDebtUsd > 0 && <span className="font-zen text-xs text-secondary">${borrowerDebtUsd.toFixed(2)}</span>}
          </div>
        </div>
        <div className="rounded-sm bg-hovered p-3">
          <div className="font-zen text-xs uppercase text-secondary">Collateral</div>
          <div className="mt-1 flex items-center gap-1">
            <span className="font-zen text-sm">{formatReadable(formatBalance(borrowerCollateral, market.collateralAsset.decimals))}</span>
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
            {borrowerCollateralUsd > 0 && <span className="font-zen text-xs text-secondary">${borrowerCollateralUsd.toFixed(2)}</span>}
          </div>
        </div>
      </div>

      {hasBorrowPosition && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font text-sm text-secondary">Collateral to seize</span>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline text-secondary"
              onClick={handleMaxClick}
            >
              Max
            </button>
          </div>
          <Input
            decimals={market.collateralAsset.decimals}
            max={borrowerCollateral}
            setValue={handleInputChange}
            setError={setInputError}
            value={repayAmount}
            error={inputError}
          />
        </div>
      )}

      {!hasBorrowPosition && borrowerBorrowShares === 0n && borrowerCollateral === 0n && (
        <div className="py-4 text-center text-sm text-secondary">
          {isLoading ? 'Loading position data...' : 'No position found for this borrower'}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <ExecuteTransactionButton
          targetChainId={market.morphoBlue.chain.id}
          onClick={handleLiquidate}
          isLoading={liquidatePending}
          disabled={!isValid || !hasBorrowPosition}
          variant="primary"
        >
          Liquidate
        </ExecuteTransactionButton>
      </div>
    </div>
  );
}
