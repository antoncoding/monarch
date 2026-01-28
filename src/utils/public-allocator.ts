import { type Address, encodeFunctionData } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import type { ProcessedPublicAllocatorVault } from '@/hooks/usePublicAllocatorVaults';
import type { LiveMarketData } from '@/hooks/usePublicAllocatorLiveData';

// ── Types ──

export type PAMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

export type SortedWithdrawal = {
  marketParams: PAMarketParams;
  amount: bigint;
};

// ── Bundler Calldata ──

/**
 * Build bundler-compatible reallocateTo calldata.
 * Can be prepended to a multicall batch (borrow) or called standalone.
 */
export function buildBundlerReallocateCalldata(
  publicAllocatorAddress: Address,
  vaultAddress: Address,
  fee: bigint,
  withdrawals: SortedWithdrawal[],
  supplyMarketParams: PAMarketParams,
): `0x${string}` {
  return encodeFunctionData({
    abi: morphoBundlerAbi,
    functionName: 'reallocateTo',
    args: [publicAllocatorAddress, vaultAddress, fee, withdrawals, supplyMarketParams],
  });
}

// ── Pullable Amount Calculations ──

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Calculate max pullable liquidity from a vault into the target market (API data only).
 *
 * Bounded by:
 * 1. Per-source: min(flowCap.maxOut, vaultSupply, marketLiquidity)
 * 2. Target market: flowCap.maxIn
 * 3. Target market: supplyCap - currentSupply (remaining vault capacity)
 */
export function getVaultPullableAmount(vault: ProcessedPublicAllocatorVault, targetMarketKey: string): bigint {
  let total = 0n;

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const cap = vault.flowCapsByMarket.get(alloc.market.uniqueKey);
    if (!cap || cap.maxOut === 0n) continue;

    const vaultSupply = BigInt(alloc.supplyAssets);
    const liquidity = BigInt(alloc.market.state.liquidityAssets);

    let pullable = cap.maxOut;
    if (vaultSupply < pullable) pullable = vaultSupply;
    if (liquidity < pullable) pullable = liquidity;
    if (pullable > 0n) total += pullable;
  }

  // Cap by target market's maxIn flow cap
  const targetCap = vault.flowCapsByMarket.get(targetMarketKey);
  if (!targetCap) {
    return 0n;
  }
  if (total > targetCap.maxIn) {
    total = targetCap.maxIn;
  }

  // Cap by remaining supply cap for the target market in this vault
  const targetAlloc = vault.state.allocation.find((a) => a.market.uniqueKey === targetMarketKey);
  if (targetAlloc) {
    const supplyCap = BigInt(targetAlloc.supplyCap);
    const currentSupply = BigInt(targetAlloc.supplyAssets);
    const remainingCap = supplyCap > currentSupply ? supplyCap - currentSupply : 0n;
    if (total > remainingCap) total = remainingCap;
  }

  return total;
}

/**
 * Calculate max pullable liquidity using live on-chain data for flow caps,
 * vault supply, and market liquidity.
 *
 * Falls back to API values for supply cap constraints (which are less volatile).
 */
export function getVaultPullableAmountLive(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  liveData: Map<string, LiveMarketData>,
): bigint {
  let total = 0n;

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const live = liveData.get(alloc.market.uniqueKey);
    if (!live || live.maxOut === 0n) continue;

    let pullable = live.maxOut;
    if (live.vaultSupplyAssets < pullable) pullable = live.vaultSupplyAssets;
    if (live.marketLiquidity < pullable) pullable = live.marketLiquidity;
    if (pullable > 0n) total += pullable;
  }

  // Cap by target market's live maxIn flow cap
  const targetLive = liveData.get(targetMarketKey);
  if (!targetLive) {
    return 0n;
  }
  if (total > targetLive.maxIn) {
    total = targetLive.maxIn;
  }

  // Cap by remaining supply cap (uses API data — supply caps rarely change)
  const targetAlloc = vault.state.allocation.find((a) => a.market.uniqueKey === targetMarketKey);
  if (targetAlloc) {
    const supplyCap = BigInt(targetAlloc.supplyCap);
    // Use live supply if available, fall back to API
    const currentSupply = targetLive.vaultSupplyAssets;
    const remainingCap = supplyCap > currentSupply ? supplyCap - currentSupply : 0n;
    if (total > remainingCap) total = remainingCap;
  }

  return total;
}

// ── Auto-Allocation Algorithms ──

/**
 * Auto-allocate a pull amount across source markets greedily (API data).
 * Pulls from the most liquid source first.
 */
export function autoAllocateWithdrawals(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  requestedAmount: bigint,
): { marketKey: string; amount: bigint }[] {
  const sources: { marketKey: string; maxPullable: bigint }[] = [];

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const cap = vault.flowCapsByMarket.get(alloc.market.uniqueKey);
    if (!cap || cap.maxOut === 0n) continue;

    const vaultSupply = BigInt(alloc.supplyAssets);
    const liquidity = BigInt(alloc.market.state.liquidityAssets);

    let maxPullable = cap.maxOut;
    if (vaultSupply < maxPullable) maxPullable = vaultSupply;
    if (liquidity < maxPullable) maxPullable = liquidity;

    if (maxPullable > 0n) {
      sources.push({ marketKey: alloc.market.uniqueKey, maxPullable });
    }
  }

  sources.sort((a, b) => (b.maxPullable > a.maxPullable ? 1 : b.maxPullable < a.maxPullable ? -1 : 0));

  const withdrawals: { marketKey: string; amount: bigint }[] = [];
  let remaining = requestedAmount;

  for (const source of sources) {
    if (remaining <= 0n) break;
    const pullAmount = remaining < source.maxPullable ? remaining : source.maxPullable;
    withdrawals.push({ marketKey: source.marketKey, amount: pullAmount });
    remaining -= pullAmount;
  }

  return withdrawals;
}

/**
 * Auto-allocate a pull amount across source markets using live on-chain data.
 * Same greedy algorithm but uses RPC-verified flow caps, supply, and liquidity.
 */
export function autoAllocateWithdrawalsLive(
  vault: ProcessedPublicAllocatorVault,
  targetMarketKey: string,
  requestedAmount: bigint,
  liveData: Map<string, LiveMarketData>,
): { marketKey: string; amount: bigint }[] {
  const sources: { marketKey: string; maxPullable: bigint }[] = [];

  for (const alloc of vault.state.allocation) {
    if (alloc.market.uniqueKey === targetMarketKey) continue;

    const live = liveData.get(alloc.market.uniqueKey);
    if (!live || live.maxOut === 0n) continue;

    let maxPullable = live.maxOut;
    if (live.vaultSupplyAssets < maxPullable) maxPullable = live.vaultSupplyAssets;
    if (live.marketLiquidity < maxPullable) maxPullable = live.marketLiquidity;

    if (maxPullable > 0n) {
      sources.push({ marketKey: alloc.market.uniqueKey, maxPullable });
    }
  }

  sources.sort((a, b) => (b.maxPullable > a.maxPullable ? 1 : b.maxPullable < a.maxPullable ? -1 : 0));

  const withdrawals: { marketKey: string; amount: bigint }[] = [];
  let remaining = requestedAmount;

  for (const source of sources) {
    if (remaining <= 0n) break;
    const pullAmount = remaining < source.maxPullable ? remaining : source.maxPullable;
    withdrawals.push({ marketKey: source.marketKey, amount: pullAmount });
    remaining -= pullAmount;
  }

  return withdrawals;
}

// ── Withdrawal Resolution ──

/**
 * Resolve auto-allocated withdrawals (marketKey + amount) into full withdrawal
 * structs with marketParams and sort keys for the contract.
 *
 * Returns sorted by market ID ascending (contract requirement).
 */
export function resolveWithdrawals(
  vault: ProcessedPublicAllocatorVault,
  allocatedWithdrawals: { marketKey: string; amount: bigint }[],
): { marketParams: PAMarketParams; amount: bigint; sortKey: string }[] {
  const allocationMap = new Map(vault.state.allocation.map((a) => [a.market.uniqueKey, a]));

  const sources = allocatedWithdrawals
    .map(({ marketKey, amount }) => {
      const alloc = allocationMap.get(marketKey);
      if (!alloc) return null;
      return {
        marketParams: {
          loanToken: alloc.market.loanAsset.address as Address,
          collateralToken: (alloc.market.collateralAsset?.address ?? ZERO_ADDRESS) as Address,
          oracle: (alloc.market.oracle?.address ?? ZERO_ADDRESS) as Address,
          irm: alloc.market.irmAddress as Address,
          lltv: BigInt(alloc.market.lltv),
        },
        amount,
        sortKey: marketKey,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Sort by market ID ascending (contract requirement)
  sources.sort((a, b) =>
    a.sortKey.toLowerCase() < b.sortKey.toLowerCase() ? -1 : a.sortKey.toLowerCase() > b.sortKey.toLowerCase() ? 1 : 0,
  );

  return sources;
}
