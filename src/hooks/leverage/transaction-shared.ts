import type { Address } from 'viem';
import type { MorphoAuthorizationSignatureData } from '@/hooks/useMorphoAuthorization';
import type { Market } from '@/utils/types';

export type LeverageStepType =
  | 'approve_permit2'
  | 'authorize_bundler_sig'
  | 'sign_permit'
  | 'authorize_bundler_tx'
  | 'approve_token'
  | 'execute';

export type LeverageMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type AuthorizationMode = 'signature' | 'transaction';

export type EnsureLeverageAuthorization = (params: { mode: AuthorizationMode }) => Promise<{
  authorized: boolean;
  authorizationTxData: `0x${string}` | null;
  authorizationSignatureData: MorphoAuthorizationSignatureData | null;
}>;

export type Permit2LeverageSignature = {
  sigs: `0x${string}`;
  permitSingle: {
    details: {
      token: Address;
      amount: bigint;
      expiration: number;
      nonce: number;
    };
    spender: Address;
    sigDeadline: bigint;
  };
};

export type SignForLeverageBundlers = () => Promise<Permit2LeverageSignature>;

export type SendLeverageTransaction = (params: { account: Address; to: Address; data: `0x${string}`; value: bigint }) => Promise<unknown>;

export const buildLeverageMarketParams = (market: Market): LeverageMarketParams => ({
  loanToken: market.loanAsset.address as Address,
  collateralToken: market.collateralAsset.address as Address,
  oracle: market.oracleAddress as Address,
  irm: market.irmAddress as Address,
  lltv: BigInt(market.lltv),
});

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
