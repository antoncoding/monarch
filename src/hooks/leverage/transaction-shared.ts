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

export type MorphoMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type AuthorizationMode = 'signature' | 'transaction';

export type EnsureBundlerAuthorization = (params: { mode: AuthorizationMode }) => Promise<{
  authorized: boolean;
  authorizationTxData: `0x${string}` | null;
  authorizationSignatureData: MorphoAuthorizationSignatureData | null;
}>;

export type Permit2BundlerSignature = {
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

export type SignForBundlers = () => Promise<Permit2BundlerSignature>;

export type SendBundlerTransaction = (params: { account: Address; to: Address; data: `0x${string}`; value: bigint }) => Promise<unknown>;

export const buildMorphoMarketParams = (market: Market): MorphoMarketParams => ({
  loanToken: market.loanAsset.address as Address,
  collateralToken: market.collateralAsset.address as Address,
  oracle: market.oracleAddress as Address,
  irm: market.irmAddress as Address,
  lltv: BigInt(market.lltv),
});

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
