import { useState, useEffect, useCallback } from 'react';
import Input from '@/components/Input/Input';
import { useLiquidateTransaction } from '@/hooks/useLiquidateTransaction';
import { formatBalance } from '@/utils/balance';
import type { Market } from '@/utils/types';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { AccountIdentity } from '@/components/shared/account-identity';
import type { Address } from 'viem';

type LiquidateModalContentProps = {
  market: Market;
  borrower: Address;
  borrowerCollateral: bigint;
  borrowerDebt: bigint;
  onSuccess?: () => void;
};

export function LiquidateModalContent({
  market,
  borrower,
  borrowerCollateral,
  borrowerDebt,
  onSuccess,
}: LiquidateModalContentProps): JSX.Element {
  const [seizedAssets, setSeizedAssets] = useState<bigint>(BigInt(0));
  const [repaidShares, setRepaidShares] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);

  const { liquidatePending, handleLiquidate } = useLiquidateTransaction({
    market,
    borrower,
    seizedAssets,
    repaidShares,
    onSuccess,
  });

  const handleSetMax = useCallback(() => {
    setRepaidShares(borrowerDebt);
    setSeizedAssets(BigInt(0));
  }, [borrowerDebt]);

  useEffect(() => {
    if (repaidShares !== BigInt(0) && repaidShares !== borrowerDebt) {
      setRepaidShares(BigInt(0));
    }
  }, [seizedAssets, borrowerDebt]);

  const handleSeizedAssetsChange = useCallback((value: bigint) => {
    setSeizedAssets(value);
    setRepaidShares(BigInt(0));
    setInputError(null);
  }, []);

  const handleRepaidSharesChange = useCallback((value: bigint) => {
    if (value > 0n) {
      setRepaidShares(value);
      setSeizedAssets(BigInt(0));
      setInputError(null);
    }
  }, []);

  const isValid = seizedAssets > 0n || repaidShares > 0n;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-surface-soft p-3">
        <div className="mb-2 text-xs uppercase text-secondary">Borrower</div>
        <AccountIdentity
          address={borrower}
          chainId={market.morphoBlue.chain.id}
          variant="compact"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-surface-soft p-3">
          <div className="mb-1 text-xs uppercase text-secondary">Debt</div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm">{formatBalance(borrowerDebt, market.loanAsset.decimals)}</span>
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
          </div>
        </div>
        <div className="rounded bg-surface-soft p-3">
          <div className="mb-1 text-xs uppercase text-secondary">Collateral</div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm">{formatBalance(borrowerCollateral, market.collateralAsset.decimals)}</span>
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-secondary">Seize Collateral (Assets)</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={handleSetMax}
          >
            Max: {formatBalance(borrowerCollateral, market.collateralAsset.decimals)}
          </button>
        </div>
        <Input
          decimals={market.collateralAsset.decimals}
          max={borrowerCollateral}
          setValue={handleSeizedAssetsChange}
          setError={setInputError}
          value={seizedAssets}
          error={inputError}
        />
      </div>

      <div>
        <span className="mb-2 block text-sm text-secondary">Or Repay Debt (Shares)</span>
        <Input
          decimals={0}
          value={repaidShares}
          setValue={handleRepaidSharesChange}
        />
      </div>

      <ExecuteTransactionButton
        targetChainId={market.morphoBlue.chain.id}
        onClick={handleLiquidate}
        isLoading={liquidatePending}
        disabled={!isValid}
      >
        Liquidate
      </ExecuteTransactionButton>
    </div>
  );
}
