import { Address } from 'viem';
import { Market } from '@/utils/types';

/**
 * Typed allocation structures that combine cap metadata with allocation amounts.
 * These are parsed from raw VaultV2Cap data and enriched with on-chain allocations.
 */

/**
 * Allocation for a specific collateral token.
 * Represents how much of the vault's assets are allocated across all markets
 * that use this collateral token.
 */
export type CollateralAllocation = {
  type: 'collateral';
  capId: string;
  collateralAddress: Address;
  collateralSymbol: string;
  collateralDecimals: number;
  relativeCap: string;
  absoluteCap: string;
  allocation: bigint;
};

/**
 * Allocation for a specific market.
 * Represents how much of the vault's assets are allocated to a particular market.
 */
export type MarketAllocation = {
  type: 'market';
  capId: string;
  marketId: string;
  market: Market;
  relativeCap: string;
  absoluteCap: string;
  allocation: bigint;
};

/**
 * Allocation for an adapter (future use).
 * Represents allocations managed through a specific adapter contract.
 */
export type AdapterAllocation = {
  type: 'adapter';
  capId: string;
  adapterAddress: Address;
  relativeCap: string;
  absoluteCap: string;
  allocation: bigint;
};

/**
 * Discriminated union of all allocation types.
 * Use the `type` field for type narrowing in TypeScript.
 */
export type VaultAllocation = CollateralAllocation | MarketAllocation | AdapterAllocation;
