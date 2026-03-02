import type { Market as BlueMarket } from '@morpho-org/blue-sdk';
import type { Market } from '@/utils/types';

export type SmartRebalanceEngineEntry = {
  /** Stable market ID (Morpho uniqueKey) */
  uniqueKey: string;
  /** Full market metadata used by tx builder and UI */
  market: Market;
  /** Fresh on-chain market snapshot used for simulation */
  baselineMarket: BlueMarket;
  /** User's current supplied amount in this market */
  currentSupply: bigint;
  /** Max amount that can be withdrawn from this market */
  maxWithdrawable: bigint;
};

export type SmartRebalanceConstraintMap = Record<
  string,
  {
    /**
     * Optional max final allocation share in basis points.
     * Example: 5000 = 50%.
     */
    maxAllocationBps?: number;
  }
>;

export type SmartRebalanceEngineInput = {
  entries: SmartRebalanceEngineEntry[];
  constraints?: SmartRebalanceConstraintMap;
  maxRounds?: number;
  /** Candidate transfer-size fractions as [num, den] pairs */
  fractionRationals?: [bigint, bigint][];
};

export type SmartRebalanceDelta = {
  market: Market;
  currentAmount: bigint;
  targetAmount: bigint;
  delta: bigint;
  currentApy: number;
  projectedApy: number;
  currentUtilization: number;
  projectedUtilization: number;
  collateralSymbol: string;
};

export type SmartRebalanceEngineOutput = {
  deltas: SmartRebalanceDelta[];
  totalPool: bigint;
  currentWeightedApy: number;
  projectedWeightedApy: number;
  totalMoved: bigint;
};
