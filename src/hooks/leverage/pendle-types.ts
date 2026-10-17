import type { Address } from 'viem';
import type { VeloraPriceRoute } from '@/features/swap/api/velora';

export type PendlePtMetadata = {
  acceptedInputs: readonly Address[];
  acceptedOutputs: readonly Address[];
  expiry: bigint;
  pt: Address;
  sy: Address;
  yt: Address;
  underlyingToken: Address;
  underlyingDecimals: number;
};

export type PendleLeg = {
  data: `0x${string}`;
  exactInputAmount: bigint;
  executionKind: 'market-swap' | 'redeem-py';
  market: Address | null;
  minOutputAmount: bigint;
  quotedOutputAmount: bigint;
  router: Address;
};

export type PendlePtSwapQuote = {
  kind: 'pendle-pt';
  direction: 'leverage' | 'deleverage';
  srcToken: Address;
  destToken: Address;
  srcAmount: string;
  destAmount: string;
  minDestAmount: string;
  slippageBps: number;
  metadata: PendlePtMetadata;
  pendle: PendleLeg;
  externalSwap: {
    priceRoute: VeloraPriceRoute;
    inputAmount: bigint;
    minOutputAmount: bigint;
    quotedOutputAmount: bigint;
  } | null;
};

export type PendlePtLeveragePlan = {
  kind: 'pendle-pt-leverage';
  srcToken: Address;
  destToken: Address;
  srcAmount: string;
  destAmount: string;
  minDestAmount: string;
  initialCapital: PendlePtSwapQuote | null;
  flash: PendlePtSwapQuote;
};

export type ExecutableSwapQuote = VeloraPriceRoute | PendlePtSwapQuote | PendlePtLeveragePlan;
