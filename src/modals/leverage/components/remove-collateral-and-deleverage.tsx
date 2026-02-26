import { useCallback, useMemo, useState } from 'react';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Tooltip } from '@/components/ui/tooltip';
import { LTVWarning } from '@/components/shared/ltv-warning';
import { TokenIcon } from '@/components/shared/token-icon';
import { useDeleverageQuote } from '@/hooks/useDeleverageQuote';
import { useDeleverageTransaction } from '@/hooks/useDeleverageTransaction';
import { formatBalance } from '@/utils/balance';
import { formatCompactTokenAmount, formatFullTokenAmount } from '@/utils/token-amount-format';
import type { Market, MarketPosition } from '@/utils/types';
import type { LeverageSupport } from '@/hooks/leverage/types';
import { computeLtv, formatLtvPercent, getLTVColor } from '@/modals/borrow/components/helpers';
import { BorrowPositionRiskCard } from '@/modals/borrow/components/borrow-position-risk-card';

type RemoveCollateralAndDeleverageProps = {
  market: Market;
  support: LeverageSupport;
  currentPosition: MarketPosition | null;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

export function RemoveCollateralAndDeleverage({
  market,
  support,
  currentPosition,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: RemoveCollateralAndDeleverageProps): JSX.Element {
  const route = support.route;
  const [withdrawCollateralAmount, setWithdrawCollateralAmount] = useState<bigint>(0n);
  const [withdrawInputError, setWithdrawInputError] = useState<string | null>(null);

  const currentCollateralAssets = BigInt(currentPosition?.state.collateral ?? 0);
  const currentBorrowAssets = BigInt(currentPosition?.state.borrowAssets ?? 0);
  const currentBorrowShares = BigInt(currentPosition?.state.borrowShares ?? 0);
  const lltv = BigInt(market.lltv);

  const quote = useDeleverageQuote({
    chainId: market.morphoBlue.chain.id,
    route,
    withdrawCollateralAmount,
    currentBorrowAssets,
  });

  const maxWithdrawCollateral = useMemo(() => {
    if (quote.maxCollateralForDebtRepay <= 0n) return 0n;
    return quote.maxCollateralForDebtRepay > currentCollateralAssets ? currentCollateralAssets : quote.maxCollateralForDebtRepay;
  }, [quote.maxCollateralForDebtRepay, currentCollateralAssets]);

  const projectedCollateralAfterInput =
    withdrawCollateralAmount > currentCollateralAssets ? 0n : currentCollateralAssets - withdrawCollateralAmount;
  const closesDebt = currentBorrowAssets > 0n && quote.repayAmount >= currentBorrowAssets;
  const repayBySharesAmount = closesDebt ? currentBorrowShares : 0n;
  const flashLoanAmountForTx = closesDebt ? quote.rawRouteRepayAmount : quote.repayAmount;
  const autoWithdrawCollateralAmount = closesDebt ? projectedCollateralAfterInput : 0n;
  const projectedCollateralAssets = closesDebt ? 0n : projectedCollateralAfterInput;
  const projectedBorrowAssets = quote.repayAmount > currentBorrowAssets ? 0n : currentBorrowAssets - quote.repayAmount;

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

  const handleTransactionSuccess = useCallback(() => {
    // WHY: clear unwind draft after confirmation so users see the refreshed live position, not stale input.
    setWithdrawCollateralAmount(0n);
    setWithdrawInputError(null);
    if (onSuccess) onSuccess();
  }, [onSuccess]);

  const { transaction, deleveragePending, authorizeAndDeleverage } = useDeleverageTransaction({
    market,
    route,
    withdrawCollateralAmount,
    flashLoanAmount: flashLoanAmountForTx,
    repayBySharesAmount,
    autoWithdrawCollateralAmount,
    onSuccess: handleTransactionSuccess,
  });

  const handleDeleverage = useCallback(() => {
    void authorizeAndDeleverage();
  }, [authorizeAndDeleverage]);

  // Treat user input as an intent change immediately so the preview card updates as soon as the amount changes.
  const hasChanges = withdrawCollateralAmount > 0n;
  const projectedOverLimit = projectedLTV >= lltv;
  const previewDebtRepaid = closesDebt ? currentBorrowAssets : quote.repayAmount;

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
      {!transaction?.isModalVisible && (
        <div className="flex flex-col">
          <p className="mb-2 font-monospace text-xs uppercase tracking-[0.14em] text-secondary">Deleverage Preview</p>
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
                max={maxWithdrawCollateral}
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
              <p className="mt-1 text-right text-xs text-secondary">
                Max: {formatBalance(maxWithdrawCollateral, market.collateralAsset.decimals)} {market.collateralAsset.symbol}
              </p>
              {withdrawInputError && <p className="mt-1 text-right text-xs text-red-500">{withdrawInputError}</p>}
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
                          {formatFullTokenAmount(flashLoanAmountForTx, market.loanAsset.decimals)}
                        </span>
                      }
                    >
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {formatCompactTokenAmount(flashLoanAmountForTx, market.loanAsset.decimals)}
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
                  <span className="text-secondary">Debt Repaid</span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Tooltip
                      content={
                        <span className="font-monospace text-xs">
                          {formatFullTokenAmount(previewDebtRepaid, market.loanAsset.decimals)}
                        </span>
                      }
                    >
                      <span className="cursor-help border-b border-dotted border-white/40">
                        {formatCompactTokenAmount(previewDebtRepaid, market.loanAsset.decimals)}
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
                  <span className="text-secondary">Projected LTV</span>
                  <span className={`tabular-nums ${getLTVColor(projectedLTV, lltv)}`}>{formatLtvPercent(projectedLTV)}%</span>
                </div>
              </div>
              {quote.error && <p className="mt-2 text-xs text-red-500">{quote.error}</p>}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-end">
              <ExecuteTransactionButton
                targetChainId={market.morphoBlue.chain.id}
                onClick={handleDeleverage}
                isLoading={deleveragePending || quote.isLoading}
                disabled={
                  !support.supportsDeleverage ||
                  route == null ||
                  withdrawInputError !== null ||
                  quote.error !== null ||
                  withdrawCollateralAmount <= 0n ||
                  flashLoanAmountForTx <= 0n ||
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
