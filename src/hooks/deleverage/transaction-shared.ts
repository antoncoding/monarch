import { computeMaxSharePriceE27 } from '@/hooks/leverage/velora-precheck';

export type DeleverageStepType = 'authorize_bundler_sig' | 'authorize_bundler_tx' | 'execute';

export const MIN_REPAY_SHARES_SLIPPAGE_AMOUNT = 1n;

/**
 * Morpho repay slippage is mode-dependent:
 * - repay by assets: the slippage value is a minimum shares floor
 * - repay by shares: the slippage value is a maximum assets ceiling
 *
 * The Bundler V2 path passes this value directly to `morphoRepay`.
 * The GeneralAdapter path expresses the same protection as `maxSharePriceE27`.
 */
export const getDeleverageRepayBounds = ({
  flashLoanRepayAssets,
  repayBySharesAmount,
  useRepayByShares,
}: {
  flashLoanRepayAssets: bigint;
  repayBySharesAmount: bigint;
  useRepayByShares: boolean;
}) => {
  const repaySharesSlippageAmount = MIN_REPAY_SHARES_SLIPPAGE_AMOUNT;
  const bundlerV2RepaySlippageAmount = useRepayByShares ? flashLoanRepayAssets : repaySharesSlippageAmount;
  const generalAdapterRepayMaxSharePriceE27 = computeMaxSharePriceE27(
    flashLoanRepayAssets,
    useRepayByShares ? repayBySharesAmount : repaySharesSlippageAmount,
  );

  if (generalAdapterRepayMaxSharePriceE27 <= 0n) {
    throw new Error('Invalid deleverage bounds for repay-by-shares. Refresh the quote and try again.');
  }

  return {
    bundlerV2RepaySlippageAmount,
    generalAdapterRepayMaxSharePriceE27,
  };
};
