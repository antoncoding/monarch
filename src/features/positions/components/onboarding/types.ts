import type { NetworkToken } from '@/types/token';
import type { Market } from '@/utils/types';

export type TokenWithMarkets = NetworkToken & {
  markets: Market[];
  minApy: number;
  maxApy: number;
  logoURI?: string;
  balance: string;
};
