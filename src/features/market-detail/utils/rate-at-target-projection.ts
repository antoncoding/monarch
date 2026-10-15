import { AdaptiveCurveIrmLib, MarketUtils } from '@morpho-org/blue-sdk';

const SECONDS_PER_DAY = 86_400;
const UTILIZATION_PRECISION = 1_000_000_000n;
const PROJECTION_POINT_COUNT = 30;
const MAX_TARGET_ESTIMATE_DAYS = 3650;

export type RateAtTargetProjectionPoint = {
  timestamp: number;
  apyAtTarget: number;
};

export type TargetRateEstimate =
  | { status: 'reached'; seconds: number }
  | { status: 'static' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

type ProjectionState = {
  utilization: number;
  rateAtTarget: bigint;
};

const toUtilizationWad = (utilization: number): bigint => {
  const clamped = Math.min(Math.max(utilization, 0), 1);
  return BigInt(Math.round(clamped * Number(UTILIZATION_PRECISION))) * UTILIZATION_PRECISION;
};

export function projectRateAtTargetApy({
  utilization,
  rateAtTarget,
  elapsedSeconds,
}: ProjectionState & { elapsedSeconds: number }): number {
  const projected = AdaptiveCurveIrmLib.getBorrowRate(
    toUtilizationWad(utilization),
    rateAtTarget,
    BigInt(Math.max(0, Math.round(elapsedSeconds))),
  );
  return MarketUtils.rateToApy(projected.endRateAtTarget);
}

export function getCurrentRateAtTarget({
  utilization,
  storedRateAtTarget,
  lastUpdateTimestamp,
  currentTimestamp,
}: {
  utilization: number;
  storedRateAtTarget: bigint;
  lastUpdateTimestamp: number;
  currentTimestamp: number;
}): bigint {
  const elapsedSeconds = Math.max(0, currentTimestamp - lastUpdateTimestamp);
  return AdaptiveCurveIrmLib.getBorrowRate(toUtilizationWad(utilization), storedRateAtTarget, BigInt(elapsedSeconds)).endRateAtTarget;
}

export function buildRateAtTargetProjection({
  utilization,
  rateAtTarget,
  startTimestamp,
  horizonDays,
}: ProjectionState & { startTimestamp: number; horizonDays: number }): RateAtTargetProjectionPoint[] {
  const horizonSeconds = Math.max(1, Math.round(horizonDays * SECONDS_PER_DAY));

  return Array.from({ length: PROJECTION_POINT_COUNT + 1 }, (_, index) => {
    const elapsedSeconds = Math.round((horizonSeconds * index) / PROJECTION_POINT_COUNT);
    return {
      timestamp: startTimestamp + elapsedSeconds,
      apyAtTarget: projectRateAtTargetApy({ utilization, rateAtTarget, elapsedSeconds }),
    };
  });
}

export function estimateTimeToTargetRate({
  utilization,
  rateAtTarget,
  desiredApy,
}: ProjectionState & { desiredApy: number }): TargetRateEstimate {
  if (!Number.isFinite(desiredApy) || desiredApy < 0) return { status: 'invalid' };

  const currentApy = MarketUtils.rateToApy(rateAtTarget);
  const targetUtilization = Number(AdaptiveCurveIrmLib.TARGET_UTILIZATION) / 1e18;
  const isRising = utilization > targetUtilization;
  const isFalling = utilization < targetUtilization;

  if (Math.abs(desiredApy - currentApy) <= 1e-12) return { status: 'reached', seconds: 0 };
  if (!(isRising || isFalling)) return { status: 'static' };
  if ((isRising && desiredApy < currentApy) || (isFalling && desiredApy > currentApy)) return { status: 'unreachable' };

  const maxSeconds = MAX_TARGET_ESTIMATE_DAYS * SECONDS_PER_DAY;
  const reachesTarget = (elapsedSeconds: number) => {
    const projectedApy = projectRateAtTargetApy({ utilization, rateAtTarget, elapsedSeconds });
    return isRising ? projectedApy >= desiredApy : projectedApy <= desiredApy;
  };

  if (!reachesTarget(maxSeconds)) return { status: 'unreachable' };

  let lower = 0;
  let upper = maxSeconds;
  while (lower < upper) {
    const midpoint = Math.floor((lower + upper) / 2);
    if (reachesTarget(midpoint)) {
      upper = midpoint;
    } else {
      lower = midpoint + 1;
    }
  }

  return { status: 'reached', seconds: lower };
}

export const RATE_AT_TARGET_UTILIZATION = Number(AdaptiveCurveIrmLib.TARGET_UTILIZATION) / 1e18;
