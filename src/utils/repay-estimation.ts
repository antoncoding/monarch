import { MathLib, SharesMath } from '@morpho-org/blue-sdk';
import { BPS_DENOMINATOR } from '@/constants/repay';

type RepayEstimationInputs = {
  repayShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  borrowRate: bigint;
  currentTimestamp: bigint;
  safetyWindowSeconds?: bigint;
};

type RepayEstimationResult = {
  elapsedSeconds: bigint;
  expectedTotalBorrowAssets: bigint;
  assetsToRepayShares: bigint;
  safetyAssetsBuffer: bigint;
  blockDriftBuffer: bigint;
  maxAssetsToRepay: bigint;
};

const DEFAULT_SAFETY_WINDOW_SECONDS = 45n;
const BLOCK_DRIFT_BUFFER_BPS = 1n;

export const estimateRepayAssetsForBorrowShares = ({
  repayShares,
  totalBorrowAssets,
  totalBorrowShares,
  lastUpdate,
  borrowRate,
  currentTimestamp,
  safetyWindowSeconds = DEFAULT_SAFETY_WINDOW_SECONDS,
}: RepayEstimationInputs): RepayEstimationResult => {
  if (repayShares <= 0n) {
    return {
      elapsedSeconds: 0n,
      expectedTotalBorrowAssets: totalBorrowAssets,
      assetsToRepayShares: 0n,
      safetyAssetsBuffer: 0n,
      blockDriftBuffer: 0n,
      maxAssetsToRepay: 0n,
    };
  }

  const elapsedSeconds = currentTimestamp > lastUpdate ? currentTimestamp - lastUpdate : 0n;
  const accruedInterest = MathLib.wMulDown(totalBorrowAssets, MathLib.wTaylorCompounded(borrowRate, elapsedSeconds));
  const expectedTotalBorrowAssets = totalBorrowAssets + accruedInterest;
  const assetsToRepayShares = SharesMath.toAssets(repayShares, expectedTotalBorrowAssets, totalBorrowShares, 'Up');

  const safetyAssetsBuffer = MathLib.wMulUp(assetsToRepayShares, MathLib.wTaylorCompounded(borrowRate, safetyWindowSeconds));
  const blockDriftBuffer = MathLib.mulDivUp(assetsToRepayShares, BLOCK_DRIFT_BUFFER_BPS, BPS_DENOMINATOR);
  const maxAssetsToRepay = assetsToRepayShares + safetyAssetsBuffer + blockDriftBuffer;

  return {
    elapsedSeconds,
    expectedTotalBorrowAssets,
    assetsToRepayShares,
    safetyAssetsBuffer,
    blockDriftBuffer,
    maxAssetsToRepay,
  };
};
