import type { Address } from 'viem';

export type StEthLoanMode = 'steth' | 'mainnet-weth-steth-wsteth';

export type Erc4626LeverageRoute = {
  kind: 'erc4626';
  collateralVault: Address;
  underlyingLoanToken: Address;
};

export type StEthLeverageRoute = {
  kind: 'steth';
  collateralToken: Address;
  stEthToken: Address;
  loanMode: StEthLoanMode;
};

export type LeverageRoute = Erc4626LeverageRoute | StEthLeverageRoute;

export type LeverageSupport = {
  isSupported: boolean;
  supportsLeverage: boolean;
  supportsDeleverage: boolean;
  isLoading: boolean;
  route: LeverageRoute | null;
  reason: string | null;
};

export const LEVERAGE_MULTIPLIER_SCALE_BPS = 10_000n;
export const LEVERAGE_MIN_MULTIPLIER_BPS = 10_000n; // 1.00x
export const LEVERAGE_DEFAULT_MULTIPLIER_BPS = 20_000n; // 2.00x
export const LEVERAGE_MAX_MULTIPLIER_BPS = 100_000n; // 10.00x
