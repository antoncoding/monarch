import { getLeverageFee, getLeverageFeeCeilingUsd } from '@/config/fees';
import type { LeverageRoute } from './types';

type RouteLeverageFeeParams = {
  amount: bigint;
  assetDecimals: number;
  assetPriceUsd: number | null;
  route: LeverageRoute | null;
};

export const isPendlePtLeverageRoute = (route: LeverageRoute | null): boolean => route?.kind === 'swap' && route.conversion === 'pendle-pt';

export const getRouteLeverageFeeCeilingUsd = (route: LeverageRoute | null): number =>
  getLeverageFeeCeilingUsd(isPendlePtLeverageRoute(route));

export const getRouteLeverageFee = ({ amount, assetDecimals, assetPriceUsd, route }: RouteLeverageFeeParams): bigint | null => {
  const isPendlePt = isPendlePtLeverageRoute(route);
  if (isPendlePt && assetPriceUsd == null) return null;
  return getLeverageFee({ amount, assetDecimals, assetPriceUsd, isPendlePt });
};
