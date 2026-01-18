import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLiquidateTransaction } from '@/hooks/useLiquidateTransaction';
import type { Market } from '@/utils/types';

type Borrower = {
  userAddress: string;
  borrowAssets: string;
  collateral: string;
  ltv: number;
};

type LiquidateButtonProps = {
  market: Market;
  borrower: Borrower;
  onSuccess?: () => void;
};

export function LiquidateButton({ market, borrower, onSuccess }: LiquidateButtonProps) {
  // Seize all collateral - Morpho will calculate the appropriate repayment
  const seizedAssets = BigInt(borrower.collateral);

  const { isApproved, isLoading, approveAndLiquidate, signAndLiquidate } = useLiquidateTransaction({
    market,
    borrower,
    seizedAssets,
    onSuccess,
  });

  const handleClick = useCallback(() => {
    if (!isApproved) {
      void approveAndLiquidate();
    } else {
      void signAndLiquidate();
    }
  }, [isApproved, approveAndLiquidate, signAndLiquidate]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? 'Processing...' : 'Liquidate'}
    </Button>
  );
}
