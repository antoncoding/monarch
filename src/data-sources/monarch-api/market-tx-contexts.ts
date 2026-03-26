import { isAddress } from 'viem';
import { envioMarketTxContextSeedsQuery, envioMarketTxContextsByIdsQuery } from '@/graphql/envio-queries';
import { monarchGraphqlFetcher } from './fetchers';

const MONARCH_MARKET_TX_CONTEXTS_TIMEOUT_MS = 15_000;
const MARKET_TX_CONTEXT_DISCOVERY_BATCH_SIZE_FLOOR = 24;
const MARKET_TX_CONTEXT_DISCOVERY_BATCH_SIZE_MULTIPLIER = 4;
const MARKET_TX_CONTEXT_DISCOVERY_EXTRA_ROUNDS = 2;

type MorphoMarketLegKind = 'supply' | 'withdraw' | 'borrow' | 'repay' | 'supplyCollateral' | 'withdrawCollateral';
type VaultLegKind = 'vaultDeposit' | 'vaultWithdraw';
type VaultRebalanceLegKind =
  | 'vaultAllocate'
  | 'vaultDeallocate'
  | 'vaultForceDeallocate'
  | 'legacyVaultReallocateSupply'
  | 'legacyVaultReallocateWithdraw';
type MarketProActivityLegKind = MorphoMarketLegKind | VaultLegKind | VaultRebalanceLegKind;

type MonarchMorphoMarketLegRow = {
  market_id: string;
  assets: string;
  onBehalf: string;
  caller: string;
  receiver?: string;
  isMonarch: boolean;
};

type MonarchVaultDepositRow = {
  id: string;
  vault_id: string;
  onBehalf: string;
  sender: string;
  assets: string;
  shares: string;
  isMonarch: boolean;
};

type MonarchVaultWithdrawRow = {
  id: string;
  vault_id: string;
  onBehalf: string;
  sender: string;
  receiver: string;
  assets: string;
  shares: string;
  isMonarch: boolean;
};

type MonarchLegacyVaultDepositRow = {
  id: string;
  vaultAddress: string;
  owner: string;
  sender: string;
  assets: string;
  shares: string;
  isMonarch: boolean;
};

type MonarchLegacyVaultWithdrawRow = {
  id: string;
  vaultAddress: string;
  owner: string;
  sender: string;
  receiver: string;
  assets: string;
  shares: string;
  isMonarch: boolean;
};

type MonarchVaultRebalanceRow = {
  id: string;
  vault_id: string;
  sender: string;
  assets: string;
  change: string;
  isMonarch: boolean;
};

type MonarchVaultForceDeallocateRow = {
  id: string;
  vault_id: string;
  onBehalf: string;
  sender: string;
  assets: string;
  penaltyAssets: string;
  isMonarch: boolean;
};

type MonarchLegacyVaultReallocateSupplyRow = {
  id: string;
  vaultAddress: string;
  market_id: string;
  suppliedAssets: string;
  suppliedShares: string;
  caller: string;
  isMonarch: boolean;
};

type MonarchLegacyVaultReallocateWithdrawRow = {
  id: string;
  vaultAddress: string;
  market_id: string;
  withdrawnAssets: string;
  withdrawnShares: string;
  caller: string;
  isMonarch: boolean;
};

type MonarchTxContextRow = {
  id: string;
  chainId: number;
  timestamp: string | number;
  txHash: string;
  vaultTxType: string;
  hasVaultUserDeposit: boolean;
  hasVaultUserWithdraw: boolean;
  hasVaultRebalance: boolean;
  morphoSupplies: MonarchMorphoMarketLegRow[];
  morphoWithdraws: MonarchMorphoMarketLegRow[];
  morphoBorrows: MonarchMorphoMarketLegRow[];
  morphoRepays: MonarchMorphoMarketLegRow[];
  morphoSupplyCollaterals: MonarchMorphoMarketLegRow[];
  morphoWithdrawCollaterals: MonarchMorphoMarketLegRow[];
  vaultDeposits: MonarchVaultDepositRow[];
  vaultWithdrawals: MonarchVaultWithdrawRow[];
  vaultAllocations: MonarchVaultRebalanceRow[];
  vaultDeallocations: MonarchVaultRebalanceRow[];
  vaultForceDeallocations: MonarchVaultForceDeallocateRow[];
  legacyVaultDeposits: MonarchLegacyVaultDepositRow[];
  legacyVaultWithdrawals: MonarchLegacyVaultWithdrawRow[];
  legacyVaultReallocateSupplies: MonarchLegacyVaultReallocateSupplyRow[];
  legacyVaultReallocateWithdrawals: MonarchLegacyVaultReallocateWithdrawRow[];
};

type MonarchTxContextRefRow = {
  id: string;
  txHash: string;
  timestamp: string | number;
};

type MonarchMarketTxContextSeedRow = {
  id: string;
  txHash: string;
  timestamp: string | number;
  txContext?: MonarchTxContextRefRow | null;
};

type MonarchMarketTxContextSeedsPageResponse = {
  data?: {
    supplies?: MonarchMarketTxContextSeedRow[];
    withdraws?: MonarchMarketTxContextSeedRow[];
    borrows?: MonarchMarketTxContextSeedRow[];
    repays?: MonarchMarketTxContextSeedRow[];
    supplyCollaterals?: MonarchMarketTxContextSeedRow[];
    withdrawCollaterals?: MonarchMarketTxContextSeedRow[];
    legacyReallocateSupplies?: MonarchMarketTxContextSeedRow[];
    legacyReallocateWithdrawals?: MonarchMarketTxContextSeedRow[];
  };
};

type MonarchMarketTxContextsPageResponse = {
  data?: {
    TxContext?: MonarchTxContextRow[];
  };
};

type MarketTxContextSeed = {
  contextId: string;
  hash: string;
  timestamp: number;
};

export type MarketProActivityKind =
  | 'directSupply'
  | 'directWithdraw'
  | 'directBorrow'
  | 'directRepay'
  | 'vaultDeposit'
  | 'vaultWithdraw'
  | 'vaultRebalance'
  | 'monarchTx'
  | 'others'
  | 'batched';

type MarketProImpactKind = 'supply' | 'withdraw' | 'borrow' | 'repay' | 'supplyCollateral' | 'withdrawCollateral';

export type MarketProActivityLeg = {
  id: string;
  kind: MarketProActivityLegKind;
  source: 'morpho' | 'vault-v2' | 'legacy-vault';
  marketId?: string;
  amount: string;
  assetType: 'loan' | 'collateral';
  isMonarch: boolean;
  positionAddress?: string;
  actorAddress?: string;
  receiverAddress?: string;
  vaultAddress?: string;
  isCurrentMarket: boolean;
};

export type MarketProActivity = {
  id: string;
  hash: string;
  chainId: number;
  timestamp: number;
  kind: MarketProActivityKind;
  isMonarch: boolean;
  actorAddress?: string;
  vaultAddress?: string;
  amount: string | null;
  amountAssetType: 'loan' | 'collateral' | null;
  primaryLegKind: MarketProImpactKind | null;
  touchedMarketIds: string[];
  fromMarketIds: string[];
  toMarketIds: string[];
  currentMarketLegCount: number;
  legs: MarketProActivityLeg[];
};

export type PaginatedMarketProActivities = {
  items: MarketProActivity[];
  totalCount: number;
  hasNextPage: boolean;
};

const toTimestamp = (value: string | number): number => (typeof value === 'number' ? value : Number.parseInt(value, 10));

const sameMarket = (left: string | undefined, right: string): boolean => left?.toLowerCase() === right.toLowerCase();

const isMorphoMarketLegKind = (kind: MarketProActivityLegKind): kind is MorphoMarketLegKind => {
  return (
    kind === 'supply' ||
    kind === 'withdraw' ||
    kind === 'borrow' ||
    kind === 'repay' ||
    kind === 'supplyCollateral' ||
    kind === 'withdrawCollateral'
  );
};

const isSupplyLikeLeg = (leg: MarketProActivityLeg): boolean => leg.kind === 'supply' || leg.kind === 'legacyVaultReallocateSupply';

const isWithdrawLikeLeg = (leg: MarketProActivityLeg): boolean =>
  leg.kind === 'withdraw' || leg.kind === 'legacyVaultReallocateWithdraw';

const hasDistinctMarketPair = (fromMarketIds: Set<string>, toMarketIds: Set<string>): boolean => {
  for (const fromMarketId of fromMarketIds) {
    for (const toMarketId of toMarketIds) {
      if (fromMarketId !== toMarketId) {
        return true;
      }
    }
  }

  return false;
};

const isTrueVaultRebalanceContext = (context: MonarchTxContextRow): boolean => {
  const hasVaultContext =
    context.hasVaultRebalance ||
    context.vaultTxType === 'rebalance' ||
    context.vaultTxType === 'mixed' ||
    context.hasVaultUserDeposit ||
    context.hasVaultUserWithdraw ||
    context.vaultDeposits.length > 0 ||
    context.vaultWithdrawals.length > 0 ||
    context.vaultAllocations.length > 0 ||
    context.vaultDeallocations.length > 0 ||
    context.vaultForceDeallocations.length > 0 ||
    context.legacyVaultDeposits.length > 0 ||
    context.legacyVaultWithdrawals.length > 0 ||
    context.legacyVaultReallocateSupplies.length > 0 ||
    context.legacyVaultReallocateWithdrawals.length > 0;

  if (!hasVaultContext) {
    return false;
  }

  const supplyMarketIds = new Set(context.morphoSupplies.map((leg) => leg.market_id.toLowerCase()));
  const withdrawMarketIds = new Set(context.morphoWithdraws.map((leg) => leg.market_id.toLowerCase()));

  return supplyMarketIds.size > 0 && withdrawMarketIds.size > 0 && hasDistinctMarketPair(withdrawMarketIds, supplyMarketIds);
};

const uniqueMarketIds = (legs: MarketProActivityLeg[]): string[] => {
  const seen = new Set<string>();
  const marketIds: string[] = [];

  for (const leg of legs) {
    if (!leg.marketId) {
      continue;
    }

    const normalizedMarketId = leg.marketId.toLowerCase();
    if (seen.has(normalizedMarketId)) {
      continue;
    }

    seen.add(normalizedMarketId);
    marketIds.push(leg.marketId);
  }

  return marketIds;
};

const sumAssets = (legs: MarketProActivityLeg[]): bigint => {
  let total = 0n;

  for (const leg of legs) {
    total += BigInt(leg.amount);
  }

  return total;
};

const toOptionalAddress = (value: string | undefined | null): string | undefined => {
  if (!value || !isAddress(value)) {
    return undefined;
  }

  return value;
};

const parseVaultIdAddress = (vaultId: string | undefined): string | undefined => {
  if (!vaultId) {
    return undefined;
  }

  const [, address] = vaultId.split('_');
  return toOptionalAddress(address);
};

const mapMorphoLegs = (
  rows: MonarchMorphoMarketLegRow[] | undefined,
  kind: MorphoMarketLegKind,
  assetType: 'loan' | 'collateral',
  currentMarketId: string,
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row, index) => ({
    id: `${kind}-${row.market_id}-${row.assets}-${row.caller}-${index}`,
    kind,
    source: 'morpho',
    marketId: row.market_id,
    amount: row.assets,
    assetType,
    isMonarch: row.isMonarch,
    positionAddress: toOptionalAddress(row.onBehalf),
    actorAddress: toOptionalAddress(row.caller) ?? toOptionalAddress(row.onBehalf),
    receiverAddress: toOptionalAddress(row.receiver),
    isCurrentMarket: sameMarket(row.market_id, currentMarketId),
  }));
};

const mapVaultDepositLegs = (
  rows: MonarchVaultDepositRow[] | undefined,
  source: 'vault-v2' | 'legacy-vault',
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'vaultDeposit',
    source,
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender) ?? toOptionalAddress(row.onBehalf),
    positionAddress: toOptionalAddress(row.onBehalf),
    vaultAddress: parseVaultIdAddress(row.vault_id),
    isCurrentMarket: false,
  }));
};

const mapVaultWithdrawLegs = (
  rows: MonarchVaultWithdrawRow[] | undefined,
  source: 'vault-v2' | 'legacy-vault',
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'vaultWithdraw',
    source,
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender) ?? toOptionalAddress(row.onBehalf),
    positionAddress: toOptionalAddress(row.onBehalf),
    receiverAddress: toOptionalAddress(row.receiver),
    vaultAddress: parseVaultIdAddress(row.vault_id),
    isCurrentMarket: false,
  }));
};

const mapLegacyVaultDepositLegs = (rows: MonarchLegacyVaultDepositRow[] | undefined): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'vaultDeposit',
    source: 'legacy-vault',
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender) ?? toOptionalAddress(row.owner),
    positionAddress: toOptionalAddress(row.owner),
    vaultAddress: toOptionalAddress(row.vaultAddress),
    isCurrentMarket: false,
  }));
};

const mapLegacyVaultWithdrawLegs = (rows: MonarchLegacyVaultWithdrawRow[] | undefined): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'vaultWithdraw',
    source: 'legacy-vault',
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender) ?? toOptionalAddress(row.owner),
    positionAddress: toOptionalAddress(row.owner),
    receiverAddress: toOptionalAddress(row.receiver),
    vaultAddress: toOptionalAddress(row.vaultAddress),
    isCurrentMarket: false,
  }));
};

const mapVaultAllocationLegs = (
  rows: MonarchVaultRebalanceRow[] | undefined,
  kind: 'vaultAllocate' | 'vaultDeallocate',
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind,
    source: 'vault-v2',
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender),
    vaultAddress: parseVaultIdAddress(row.vault_id),
    isCurrentMarket: false,
  }));
};

const mapVaultForceDeallocateLegs = (rows: MonarchVaultForceDeallocateRow[] | undefined): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'vaultForceDeallocate',
    source: 'vault-v2',
    amount: row.assets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.sender) ?? toOptionalAddress(row.onBehalf),
    positionAddress: toOptionalAddress(row.onBehalf),
    vaultAddress: parseVaultIdAddress(row.vault_id),
    isCurrentMarket: false,
  }));
};

const mapLegacyVaultReallocateSupplyLegs = (
  rows: MonarchLegacyVaultReallocateSupplyRow[] | undefined,
  currentMarketId: string,
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'legacyVaultReallocateSupply',
    source: 'legacy-vault',
    marketId: row.market_id,
    amount: row.suppliedAssets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.caller),
    vaultAddress: toOptionalAddress(row.vaultAddress),
    isCurrentMarket: sameMarket(row.market_id, currentMarketId),
  }));
};

const mapLegacyVaultReallocateWithdrawLegs = (
  rows: MonarchLegacyVaultReallocateWithdrawRow[] | undefined,
  currentMarketId: string,
): MarketProActivityLeg[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    kind: 'legacyVaultReallocateWithdraw',
    source: 'legacy-vault',
    marketId: row.market_id,
    amount: row.withdrawnAssets,
    assetType: 'loan',
    isMonarch: row.isMonarch,
    actorAddress: toOptionalAddress(row.caller),
    vaultAddress: toOptionalAddress(row.vaultAddress),
    isCurrentMarket: sameMarket(row.market_id, currentMarketId),
  }));
};

const getCurrentMarketImpactLegs = (legs: MarketProActivityLeg[]): MarketProActivityLeg[] => {
  return legs.filter((leg) => {
    if (!leg.isCurrentMarket) {
      return false;
    }

    return isMorphoMarketLegKind(leg.kind) || leg.kind === 'legacyVaultReallocateSupply' || leg.kind === 'legacyVaultReallocateWithdraw';
  });
};

const selectLargestLeg = (legs: MarketProActivityLeg[]): MarketProActivityLeg | null => {
  let largest: MarketProActivityLeg | null = null;

  for (const leg of legs) {
    if (!largest || BigInt(leg.amount) > BigInt(largest.amount)) {
      largest = leg;
    }
  }

  return largest;
};

const selectPrimaryLegForKind = (
  kind: MarketProActivityKind,
  currentMarketLegs: MarketProActivityLeg[],
): MarketProActivityLeg | undefined => {
  if (kind === 'directBorrow') {
    return currentMarketLegs.find((leg) => leg.kind === 'borrow');
  }

  if (kind === 'directRepay') {
    return currentMarketLegs.find((leg) => leg.kind === 'repay');
  }

  if (kind === 'directSupply' || kind === 'vaultDeposit') {
    return currentMarketLegs.find((leg) => leg.kind === 'supply');
  }

  if (kind === 'directWithdraw' || kind === 'vaultWithdraw') {
    return currentMarketLegs.find((leg) => leg.kind === 'withdraw');
  }

  return undefined;
};

const deriveKind = (
  context: MonarchTxContextRow,
  currentMarketLegs: MarketProActivityLeg[],
  isMonarch: boolean,
): MarketProActivityKind => {
  const isVaultUserDepositContext = context.hasVaultUserDeposit || context.vaultTxType === 'user_deposit';
  const isVaultUserWithdrawContext = context.hasVaultUserWithdraw || context.vaultTxType === 'user_withdraw';
  const isVaultRebalanceContext = isTrueVaultRebalanceContext(context);
  const currentActionKinds = new Set(currentMarketLegs.map((leg) => leg.kind));
  const hasSupply = currentMarketLegs.some((leg) => leg.kind === 'supply');
  const hasWithdraw = currentMarketLegs.some((leg) => leg.kind === 'withdraw');
  const hasBorrow = currentMarketLegs.some((leg) => leg.kind === 'borrow');
  const hasRepay = currentMarketLegs.some((leg) => leg.kind === 'repay');
  const hasSupplyCollateral = currentMarketLegs.some((leg) => leg.kind === 'supplyCollateral');
  const hasWithdrawCollateral = currentMarketLegs.some((leg) => leg.kind === 'withdrawCollateral');
  const loanActionKinds = new Set<MarketProActivityKind | 'supply' | 'withdraw' | 'borrow' | 'repay'>();

  if (hasSupply) {
    loanActionKinds.add('supply');
  }

  if (hasWithdraw) {
    loanActionKinds.add('withdraw');
  }

  if (hasBorrow) {
    loanActionKinds.add('borrow');
  }

  if (hasRepay) {
    loanActionKinds.add('repay');
  }

  const hasMixedLoanActions = loanActionKinds.size > 1;

  if (hasMixedLoanActions) {
    return 'batched';
  }

  if (hasBorrow && !hasRepay && !hasSupply && !hasWithdraw && !hasWithdrawCollateral) {
    return 'directBorrow';
  }

  if (hasRepay && !hasBorrow && !hasSupply && !hasWithdraw && !hasSupplyCollateral) {
    return 'directRepay';
  }

  if (isVaultUserDepositContext && !isVaultUserWithdrawContext && !isVaultRebalanceContext && currentActionKinds.size === 1 && hasSupply) {
    return 'vaultDeposit';
  }

  if (isVaultUserWithdrawContext && !isVaultUserDepositContext && !isVaultRebalanceContext && currentActionKinds.size === 1 && hasWithdraw) {
    return 'vaultWithdraw';
  }

  if (isVaultRebalanceContext) {
    if (hasBorrow || hasRepay) {
      return 'batched';
    }

    return isMonarch ? 'monarchTx' : 'vaultRebalance';
  }

  if (!hasSupply && !hasWithdraw && !hasBorrow && !hasRepay && (hasSupplyCollateral || hasWithdrawCollateral)) {
    return 'others';
  }

  if (currentActionKinds.size === 1 && hasSupply && !hasWithdraw) {
    return 'directSupply';
  }

  if (currentActionKinds.size === 1 && hasWithdraw && !hasSupply) {
    return 'directWithdraw';
  }

  return 'batched';
};

const deriveActorAddress = (
  context: MonarchTxContextRow,
  currentMarketLegs: MarketProActivityLeg[],
  kind: MarketProActivityKind,
): string | undefined => {
  if (kind === 'batched') {
    const borrowLeg = currentMarketLegs.find((leg) => leg.kind === 'borrow');
    if (borrowLeg) {
      return borrowLeg.positionAddress ?? borrowLeg.actorAddress;
    }

    const repayLeg = currentMarketLegs.find((leg) => leg.kind === 'repay');
    if (repayLeg) {
      return repayLeg.positionAddress ?? repayLeg.actorAddress;
    }

    return currentMarketLegs[0]?.positionAddress ?? currentMarketLegs[0]?.actorAddress;
  }

  const primaryLeg = selectPrimaryLegForKind(kind, currentMarketLegs);
  if (primaryLeg && (kind === 'directBorrow' || kind === 'directRepay' || kind === 'directSupply' || kind === 'directWithdraw')) {
    return primaryLeg.positionAddress ?? primaryLeg.actorAddress;
  }

  const isVaultUserDepositContext = context.hasVaultUserDeposit || context.vaultTxType === 'user_deposit';
  const isVaultUserWithdrawContext = context.hasVaultUserWithdraw || context.vaultTxType === 'user_withdraw';

  if (kind === 'vaultDeposit' && isVaultUserDepositContext) {
    return (
      toOptionalAddress(context.vaultDeposits[0]?.onBehalf) ??
      toOptionalAddress(context.legacyVaultDeposits[0]?.owner) ??
      toOptionalAddress(context.vaultDeposits[0]?.sender) ??
      toOptionalAddress(context.legacyVaultDeposits[0]?.sender) ??
      primaryLeg?.actorAddress
    );
  }

  if (kind === 'vaultWithdraw' && isVaultUserWithdrawContext) {
    return (
      toOptionalAddress(context.vaultWithdrawals[0]?.onBehalf) ??
      toOptionalAddress(context.legacyVaultWithdrawals[0]?.owner) ??
      toOptionalAddress(context.vaultWithdrawals[0]?.receiver) ??
      toOptionalAddress(context.legacyVaultWithdrawals[0]?.receiver) ??
      toOptionalAddress(context.vaultWithdrawals[0]?.sender) ??
      toOptionalAddress(context.legacyVaultWithdrawals[0]?.sender) ??
      primaryLeg?.actorAddress
    );
  }

  if (context.hasVaultRebalance) {
    return (
      toOptionalAddress(context.legacyVaultReallocateSupplies[0]?.caller) ??
      toOptionalAddress(context.legacyVaultReallocateWithdrawals[0]?.caller) ??
      toOptionalAddress(context.vaultAllocations[0]?.sender) ??
      toOptionalAddress(context.vaultDeallocations[0]?.sender) ??
      toOptionalAddress(context.vaultForceDeallocations[0]?.onBehalf) ??
      toOptionalAddress(context.vaultForceDeallocations[0]?.sender) ??
      currentMarketLegs[0]?.actorAddress ??
      currentMarketLegs[0]?.positionAddress
    );
  }

  return currentMarketLegs[0]?.positionAddress ?? currentMarketLegs[0]?.actorAddress;
};

const deriveVaultAddress = (
  context: MonarchTxContextRow,
  currentMarketLegs: MarketProActivityLeg[],
  kind: MarketProActivityKind,
): string | undefined => {
  const explicitVaultAddress =
    parseVaultIdAddress(context.vaultDeposits[0]?.vault_id) ??
    parseVaultIdAddress(context.vaultWithdrawals[0]?.vault_id) ??
    parseVaultIdAddress(context.vaultAllocations[0]?.vault_id) ??
    parseVaultIdAddress(context.vaultDeallocations[0]?.vault_id) ??
    parseVaultIdAddress(context.vaultForceDeallocations[0]?.vault_id) ??
    toOptionalAddress(context.legacyVaultDeposits[0]?.vaultAddress) ??
    toOptionalAddress(context.legacyVaultWithdrawals[0]?.vaultAddress) ??
    toOptionalAddress(context.legacyVaultReallocateSupplies[0]?.vaultAddress) ??
    toOptionalAddress(context.legacyVaultReallocateWithdrawals[0]?.vaultAddress);

  if (explicitVaultAddress) {
    return explicitVaultAddress;
  }

  const isVaultUserDepositContext = context.hasVaultUserDeposit || context.vaultTxType === 'user_deposit';
  const isVaultUserWithdrawContext = context.hasVaultUserWithdraw || context.vaultTxType === 'user_withdraw';

  if (kind === 'vaultDeposit' && isVaultUserDepositContext) {
    return selectPrimaryLegForKind(kind, currentMarketLegs)?.positionAddress ?? currentMarketLegs[0]?.positionAddress ?? currentMarketLegs[0]?.actorAddress;
  }

  if (kind === 'vaultWithdraw' && isVaultUserWithdrawContext) {
    return selectPrimaryLegForKind(kind, currentMarketLegs)?.positionAddress ?? currentMarketLegs[0]?.positionAddress ?? currentMarketLegs[0]?.actorAddress;
  }

  return undefined;
};

const derivePrimaryImpact = (
  kind: MarketProActivityKind,
  currentMarketLegs: MarketProActivityLeg[],
): { amount: string | null; amountAssetType: 'loan' | 'collateral' | null; primaryLegKind: MarketProImpactKind | null } => {
  const supplyLegs = currentMarketLegs.filter((leg) => isSupplyLikeLeg(leg));
  const withdrawLegs = currentMarketLegs.filter((leg) => isWithdrawLikeLeg(leg));
  const borrowLegs = currentMarketLegs.filter((leg) => leg.kind === 'borrow');
  const repayLegs = currentMarketLegs.filter((leg) => leg.kind === 'repay');
  const supplyCollateralLegs = currentMarketLegs.filter((leg) => leg.kind === 'supplyCollateral');
  const withdrawCollateralLegs = currentMarketLegs.filter((leg) => leg.kind === 'withdrawCollateral');

  if (kind === 'vaultDeposit' || kind === 'directSupply') {
    const amount = sumAssets(supplyLegs);
    return amount > 0n ? { amount: amount.toString(), amountAssetType: 'loan', primaryLegKind: 'supply' } : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  if (kind === 'vaultWithdraw' || kind === 'directWithdraw') {
    const amount = sumAssets(withdrawLegs);
    return amount > 0n ? { amount: amount.toString(), amountAssetType: 'loan', primaryLegKind: 'withdraw' } : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  if (kind === 'directBorrow') {
    const amount = sumAssets(borrowLegs);
    return amount > 0n ? { amount: amount.toString(), amountAssetType: 'loan', primaryLegKind: 'borrow' } : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  if (kind === 'directRepay') {
    const amount = sumAssets(repayLegs);
    return amount > 0n ? { amount: amount.toString(), amountAssetType: 'loan', primaryLegKind: 'repay' } : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  if (kind === 'vaultRebalance' || kind === 'monarchTx') {
    const netSupply = sumAssets(supplyLegs);
    const netWithdraw = sumAssets(withdrawLegs);

    if (netSupply > netWithdraw && netSupply > 0n) {
      return { amount: netSupply.toString(), amountAssetType: 'loan', primaryLegKind: 'supply' };
    }

    if (netWithdraw > 0n) {
      return { amount: netWithdraw.toString(), amountAssetType: 'loan', primaryLegKind: 'withdraw' };
    }
  }

  if (supplyCollateralLegs.length > 0 && withdrawCollateralLegs.length === 0) {
    const amount = sumAssets(supplyCollateralLegs);
    return amount > 0n
      ? { amount: amount.toString(), amountAssetType: 'collateral', primaryLegKind: 'supplyCollateral' }
      : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  if (withdrawCollateralLegs.length > 0 && supplyCollateralLegs.length === 0) {
    const amount = sumAssets(withdrawCollateralLegs);
    return amount > 0n
      ? { amount: amount.toString(), amountAssetType: 'collateral', primaryLegKind: 'withdrawCollateral' }
      : { amount: null, amountAssetType: null, primaryLegKind: null };
  }

  const fallbackLeg = selectLargestLeg(currentMarketLegs);

  return {
    amount: fallbackLeg?.amount ?? null,
    amountAssetType: fallbackLeg?.assetType ?? null,
    primaryLegKind: fallbackLeg && isMorphoMarketLegKind(fallbackLeg.kind) ? fallbackLeg.kind : null,
  };
};

const normalizeTxContext = (context: MonarchTxContextRow, marketId: string): MarketProActivity | null => {
  const morphoLegs = [
    ...mapMorphoLegs(context.morphoSupplies, 'supply', 'loan', marketId),
    ...mapMorphoLegs(context.morphoWithdraws, 'withdraw', 'loan', marketId),
    ...mapMorphoLegs(context.morphoBorrows, 'borrow', 'loan', marketId),
    ...mapMorphoLegs(context.morphoRepays, 'repay', 'loan', marketId),
    ...mapMorphoLegs(context.morphoSupplyCollaterals, 'supplyCollateral', 'collateral', marketId),
    ...mapMorphoLegs(context.morphoWithdrawCollaterals, 'withdrawCollateral', 'collateral', marketId),
  ];
  const vaultLegs = [
    ...mapVaultDepositLegs(context.vaultDeposits, 'vault-v2'),
    ...mapVaultWithdrawLegs(context.vaultWithdrawals, 'vault-v2'),
    ...mapLegacyVaultDepositLegs(context.legacyVaultDeposits),
    ...mapLegacyVaultWithdrawLegs(context.legacyVaultWithdrawals),
    ...mapVaultAllocationLegs(context.vaultAllocations, 'vaultAllocate'),
    ...mapVaultAllocationLegs(context.vaultDeallocations, 'vaultDeallocate'),
    ...mapVaultForceDeallocateLegs(context.vaultForceDeallocations),
    ...mapLegacyVaultReallocateSupplyLegs(context.legacyVaultReallocateSupplies, marketId),
    ...mapLegacyVaultReallocateWithdrawLegs(context.legacyVaultReallocateWithdrawals, marketId),
  ];
  const legs = [...morphoLegs, ...vaultLegs];
  const currentMarketLegs = getCurrentMarketImpactLegs(legs);

  if (currentMarketLegs.length === 0) {
    return null;
  }

  const isMonarch = legs.some((leg) => leg.isMonarch);
  const kind = deriveKind(context, currentMarketLegs, isMonarch);
  const actorAddress = deriveActorAddress(context, currentMarketLegs, kind);
  const vaultAddress = deriveVaultAddress(context, currentMarketLegs, kind);
  const impact = derivePrimaryImpact(kind, currentMarketLegs);
  const marketLegs = legs.filter((leg) => leg.marketId);
  const fromMarketIds = uniqueMarketIds(marketLegs.filter((leg) => isWithdrawLikeLeg(leg)));
  const toMarketIds = uniqueMarketIds(marketLegs.filter((leg) => isSupplyLikeLeg(leg)));
  const touchedMarketIds = uniqueMarketIds(marketLegs);

  return {
    id: context.id,
    hash: context.txHash,
    chainId: context.chainId,
    timestamp: toTimestamp(context.timestamp),
    kind,
    isMonarch,
    actorAddress,
    vaultAddress,
    amount: impact.amount,
    amountAssetType: impact.amountAssetType,
    primaryLegKind: impact.primaryLegKind,
    touchedMarketIds,
    fromMarketIds,
    toMarketIds,
    currentMarketLegCount: currentMarketLegs.length,
    legs,
  };
};

const compareMarketTxContextSeeds = (left: MarketTxContextSeed, right: MarketTxContextSeed): number => {
  if (left.timestamp !== right.timestamp) {
    return right.timestamp > left.timestamp ? 1 : -1;
  }

  const hashCompare = right.hash.localeCompare(left.hash);
  if (hashCompare !== 0) {
    return hashCompare;
  }

  return right.contextId.localeCompare(left.contextId);
};

const extractMarketTxContextSeeds = (response: MonarchMarketTxContextSeedsPageResponse): MarketTxContextSeed[] => {
  const seedRows = [
    ...(response.data?.supplies ?? []),
    ...(response.data?.withdraws ?? []),
    ...(response.data?.borrows ?? []),
    ...(response.data?.repays ?? []),
    ...(response.data?.supplyCollaterals ?? []),
    ...(response.data?.withdrawCollaterals ?? []),
    ...(response.data?.legacyReallocateSupplies ?? []),
    ...(response.data?.legacyReallocateWithdrawals ?? []),
  ];

  return seedRows.flatMap((row) => {
    if (!row.txContext?.id) {
      return [];
    }

    return [
      {
        contextId: row.txContext.id,
        hash: row.txContext.txHash,
        timestamp: toTimestamp(row.txContext.timestamp),
      },
    ];
  });
};

const getSeedPageHasMore = (response: MonarchMarketTxContextSeedsPageResponse, batchSize: number): boolean => {
  const counts = [
    response.data?.supplies?.length ?? 0,
    response.data?.withdraws?.length ?? 0,
    response.data?.borrows?.length ?? 0,
    response.data?.repays?.length ?? 0,
    response.data?.supplyCollaterals?.length ?? 0,
    response.data?.withdrawCollaterals?.length ?? 0,
    response.data?.legacyReallocateSupplies?.length ?? 0,
    response.data?.legacyReallocateWithdrawals?.length ?? 0,
  ];

  return counts.some((count) => count === batchSize);
};

const fetchMarketTxContextSeedsPage = async (
  marketId: string,
  chainId: number,
  limit: number,
  offset: number,
): Promise<MonarchMarketTxContextSeedsPageResponse> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_MARKET_TX_CONTEXTS_TIMEOUT_MS);

  try {
    return await monarchGraphqlFetcher<MonarchMarketTxContextSeedsPageResponse>(
      envioMarketTxContextSeedsQuery,
      {
        chainId,
        marketId,
        limit,
        offset,
      },
      {
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch market pro activity request timed out after ${MONARCH_MARKET_TX_CONTEXTS_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const fetchMarketTxContextsByIds = async (ids: string[]): Promise<MonarchTxContextRow[]> => {
  if (ids.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_MARKET_TX_CONTEXTS_TIMEOUT_MS);

  try {
    const response = await monarchGraphqlFetcher<MonarchMarketTxContextsPageResponse>(
      envioMarketTxContextsByIdsQuery,
      {
        ids,
      },
      {
        signal: controller.signal,
      },
    );

    return response.data?.TxContext ?? [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch market pro activity request timed out after ${MONARCH_MARKET_TX_CONTEXTS_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const discoverMarketTxContextSeeds = async (
  marketId: string,
  chainId: number,
  targetCount: number,
  batchSize: number,
  maxRounds: number,
): Promise<{ orderedSeeds: MarketTxContextSeed[]; hasMore: boolean }> => {
  const seedsById = new Map<string, MarketTxContextSeed>();
  let offset = 0;
  let hasMore = false;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await fetchMarketTxContextSeedsPage(marketId, chainId, batchSize, offset);
    const pageSeeds = extractMarketTxContextSeeds(response);

    for (const seed of pageSeeds) {
      if (!seedsById.has(seed.contextId)) {
        seedsById.set(seed.contextId, seed);
      }
    }

    hasMore = getSeedPageHasMore(response, batchSize);

    if (seedsById.size >= targetCount || !hasMore) {
      break;
    }

    offset += batchSize;
  }

  return {
    orderedSeeds: [...seedsById.values()].sort(compareMarketTxContextSeeds),
    hasMore,
  };
};

export const fetchMonarchMarketTxContexts = async (
  marketId: string,
  chainId: number,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketProActivities> => {
  const targetCount = skip + first + 1;
  const batchSize = Math.max(MARKET_TX_CONTEXT_DISCOVERY_BATCH_SIZE_FLOOR, first * MARKET_TX_CONTEXT_DISCOVERY_BATCH_SIZE_MULTIPLIER);
  const maxRounds = Math.max(3, Math.ceil(targetCount / batchSize) + MARKET_TX_CONTEXT_DISCOVERY_EXTRA_ROUNDS);
  const { orderedSeeds, hasMore: discoveryHasMore } = await discoverMarketTxContextSeeds(marketId, chainId, targetCount, batchSize, maxRounds);
  const targetSeedWindow = orderedSeeds.slice(0, targetCount);
  const hydratedContexts = await fetchMarketTxContextsByIds(targetSeedWindow.map((seed) => seed.contextId));
  const normalizedById = new Map(
    hydratedContexts
      .map((context) => normalizeTxContext(context, marketId))
      .filter((context): context is MarketProActivity => context !== null)
      .map((context) => [context.id, context] as const),
  );
  const orderedActivities = targetSeedWindow.flatMap((seed) => {
    const activity = normalizedById.get(seed.contextId);
    return activity ? [activity] : [];
  });
  const pageItems = orderedActivities.slice(skip, skip + first);
  const hasNextPage = orderedActivities.length > skip + first || discoveryHasMore;
  const totalCount = skip + pageItems.length + Number(hasNextPage);

  return {
    items: pageItems,
    totalCount,
    hasNextPage,
  };
};
