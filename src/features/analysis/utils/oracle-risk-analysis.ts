import {
  getOracleFromMetadata,
  type EnrichedFeed,
  type EnrichedVault,
  type OracleMetadataRecord,
  type OracleOutput,
  type OracleOutputData,
} from '@/hooks/useOracleMetadata';
import { checkFeedsPath, getOracleVendorInfo, PriceFeedVendors } from '@/utils/oracle';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { getNetworkName } from '@/utils/networks';
import type { Market } from '@/utils/types';

export type AnalysisExposureMetric = 'supply' | 'borrow';

export type AnalysisMarketRow = {
  id: string;
  market: Market;
  chainId: number;
  exposureUsd: number;
  supplyUsd: number;
  borrowUsd: number;
  collateralUsd: number;
  vendorLabels: string[];
  oracleType: OracleOutput['type'] | 'missing';
  actualPath: string;
  expectedPath: string;
  isValidPath: boolean;
  pegAssumptions: string[];
  vaultAssumptions: string[];
  vaultDependencies: AnalysisVaultDependency[];
  allAssumptions: string[];
  unknownLegCount: number;
};

export type AnalysisVaultDependency = {
  label: string;
  address: string;
  symbol: string;
};

export type AnalysisBucketMarket = {
  row: AnalysisMarketRow;
  attributedUsd: number;
};

export type AnalysisChainBreakdown = {
  chainId: number;
  chainName: string;
  valueUsd: number;
};

export type AnalysisBucket = {
  key: string;
  label: string;
  valueUsd: number;
  marketCount: number;
  markets: AnalysisBucketMarket[];
  chainBreakdown: AnalysisChainBreakdown[];
};

export type AnalysisAssetBucket = {
  key: string;
  label: string;
  symbol: string;
  address: string;
  chainId: number;
  valueUsd: number;
  marketCount: number;
  markets: AnalysisBucketMarket[];
};

export type RiskAnalysisResult = {
  marketCount: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  totalCollateralUsd: number;
  totalExposureUsd: number;
  invalidPathCount: number;
  unknownOracleCount: number;
  rows: AnalysisMarketRow[];
  oracleBuckets: AnalysisBucket[];
  pegAssumptionBuckets: AnalysisBucket[];
  noPegAssumptionBucket: AnalysisBucket | null;
  unknownPegRouteBucket: AnalysisBucket | null;
  vaultAssumptionBuckets: AnalysisBucket[];
  loanAssetBuckets: AnalysisAssetBucket[];
  collateralAssetBuckets: AnalysisAssetBucket[];
};

type BuildRiskAnalysisInput = {
  markets: Market[];
  oracleMetadataMap?: OracleMetadataRecord;
  exposureMetric: AnalysisExposureMetric;
};

type MutableBucket = Omit<AnalysisBucket, 'chainBreakdown'> & {
  chainBreakdownMap: Map<number, AnalysisChainBreakdown>;
};

type MutableAssetBucket = AnalysisAssetBucket;

const UNKNOWN_VENDOR = PriceFeedVendors.Unknown;
const EMPTY_PATH = 'EMPTY/EMPTY';

const safeUsd = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value ?? 0, 0);
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const getMarketExposureUsd = (market: Market, exposureMetric: AnalysisExposureMetric): number => {
  return exposureMetric === 'borrow' ? safeUsd(market.state.borrowAssetsUsd) : safeUsd(market.state.supplyAssetsUsd);
};

const getCurrentOracleData = (oracle: OracleOutput | undefined): OracleOutputData | null => {
  if (!oracle) return null;
  if (oracle.type === 'standard') return oracle.data;
  if (oracle.type !== 'meta') return null;

  const currentOracle = oracle.data.currentOracle?.toLowerCase();
  const primaryOracle = oracle.data.primaryOracle?.toLowerCase();
  const backupOracle = oracle.data.backupOracle?.toLowerCase();

  if (currentOracle && currentOracle === primaryOracle) {
    return oracle.data.oracleSources.primary;
  }

  if (currentOracle && currentOracle === backupOracle) {
    return oracle.data.oracleSources.backup;
  }

  return oracle.data.oracleSources.primary ?? oracle.data.oracleSources.backup;
};

const feedHasUnknownPair = (feed: EnrichedFeed | null): boolean => {
  if (!feed?.address) return false;
  return feed.pair.length !== 2 || feed.pair.some((asset) => asset === 'Unknown' || asset.trim() === '');
};

const countUnknownLegs = (oracleData: OracleOutputData | null): number => {
  if (!oracleData) return 0;
  return [oracleData.baseFeedOne, oracleData.baseFeedTwo, oracleData.quoteFeedOne, oracleData.quoteFeedTwo].filter(feedHasUnknownPair)
    .length;
};

const getVaultDependency = (vault: EnrichedVault | null): AnalysisVaultDependency | null => {
  if (!vault?.pair || vault.pair.length !== 2) return null;
  const [base, quote] = vault.pair;
  if (!base || !quote || base === quote) return null;

  return {
    label: `${base} <> ${quote} vault conversion`,
    address: vault.address,
    symbol: vault.symbol,
  };
};

const getVaultDependencies = (oracleData: OracleOutputData | null): AnalysisVaultDependency[] => {
  if (!oracleData) return [];
  const dependencies = [getVaultDependency(oracleData.baseVault), getVaultDependency(oracleData.quoteVault)].filter(
    (dependency): dependency is AnalysisVaultDependency => dependency != null,
  );
  const seen = new Set<string>();

  return dependencies.filter((dependency) => {
    const key = `${dependency.address.toLowerCase()}:${dependency.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveVendorLabels = (
  oracleAddress: string | undefined,
  chainId: number,
  oracleMetadataMap: OracleMetadataRecord | undefined,
): string[] => {
  const vendorInfo = getOracleVendorInfo(oracleAddress, chainId, oracleMetadataMap);
  const labels = unique([...vendorInfo.coreVendors, ...vendorInfo.taggedVendors.map((vendor) => vendor.trim())]);

  if (labels.length === 0 || vendorInfo.hasCompletelyUnknown) {
    labels.push(UNKNOWN_VENDOR);
  }

  return unique(labels);
};

const buildMarketRow = (
  market: Market,
  oracleMetadataMap: OracleMetadataRecord | undefined,
  exposureMetric: AnalysisExposureMetric,
): AnalysisMarketRow => {
  const chainId = market.morphoBlue.chain.id;
  const oracle = getOracleFromMetadata(oracleMetadataMap, market.oracleAddress, chainId);
  const oracleData = getCurrentOracleData(oracle);
  const pathResult = oracleData ? checkFeedsPath(oracleData, market.collateralAsset.symbol, market.loanAsset.symbol) : null;
  const expectedPath = `${market.collateralAsset.symbol}/${market.loanAsset.symbol}`;
  const actualPath = pathResult?.actualPath ?? (pathResult?.isValid ? expectedPath : EMPTY_PATH);
  const pegAssumptions = unique(pathResult?.inferredAssumptions ?? []);
  const vaultDependencies = getVaultDependencies(oracleData);
  const vaultAssumptions = vaultDependencies.map((dependency) => dependency.label);

  return {
    id: getMarketIdentityKey(chainId, market.uniqueKey),
    market,
    chainId,
    exposureUsd: getMarketExposureUsd(market, exposureMetric),
    supplyUsd: safeUsd(market.state.supplyAssetsUsd),
    borrowUsd: safeUsd(market.state.borrowAssetsUsd),
    collateralUsd: safeUsd(market.state.collateralAssetsUsd),
    vendorLabels: resolveVendorLabels(market.oracleAddress, chainId, oracleMetadataMap),
    oracleType: oracle?.type ?? 'missing',
    actualPath,
    expectedPath,
    isValidPath: pathResult?.isValid ?? false,
    pegAssumptions,
    vaultAssumptions,
    vaultDependencies,
    allAssumptions: unique([...pegAssumptions, ...vaultAssumptions]),
    unknownLegCount: countUnknownLegs(oracleData),
  };
};

const createBucket = (key: string, label: string): MutableBucket => ({
  key,
  label,
  valueUsd: 0,
  marketCount: 0,
  markets: [],
  chainBreakdownMap: new Map(),
});

const addToBucket = (bucket: MutableBucket, row: AnalysisMarketRow, attributedUsd: number) => {
  const valueUsd = safeUsd(attributedUsd);
  bucket.valueUsd += valueUsd;
  bucket.marketCount += 1;
  bucket.markets.push({ row, attributedUsd: valueUsd });

  const chainName = getNetworkName(row.chainId) ?? `Chain ${row.chainId}`;
  const chainBucket = bucket.chainBreakdownMap.get(row.chainId) ?? {
    chainId: row.chainId,
    chainName,
    valueUsd: 0,
  };
  chainBucket.valueUsd += valueUsd;
  bucket.chainBreakdownMap.set(row.chainId, chainBucket);
};

const finalizeBuckets = (buckets: Map<string, MutableBucket>): AnalysisBucket[] => {
  return Array.from(buckets.values())
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      valueUsd: bucket.valueUsd,
      marketCount: bucket.marketCount,
      markets: bucket.markets.sort((left, right) => right.attributedUsd - left.attributedUsd),
      chainBreakdown: Array.from(bucket.chainBreakdownMap.values()).sort((left, right) => right.valueUsd - left.valueUsd),
    }))
    .sort((left, right) => right.valueUsd - left.valueUsd);
};

const addToAssetBucket = (
  buckets: Map<string, MutableAssetBucket>,
  row: AnalysisMarketRow,
  token: Market['loanAsset'] | Market['collateralAsset'],
  valueUsd: number,
) => {
  const chainName = getNetworkName(row.chainId) ?? `Chain ${row.chainId}`;
  const key = `${row.chainId}:${token.address.toLowerCase()}`;
  const bucket =
    buckets.get(key) ??
    ({
      key,
      label: `${token.symbol} · ${chainName}`,
      symbol: token.symbol,
      address: token.address,
      chainId: row.chainId,
      valueUsd: 0,
      marketCount: 0,
      markets: [],
    } satisfies MutableAssetBucket);

  const safeValue = safeUsd(valueUsd);
  bucket.valueUsd += safeValue;
  bucket.marketCount += 1;
  bucket.markets.push({ row, attributedUsd: safeValue });
  buckets.set(key, bucket);
};

const finalizeAssetBuckets = (buckets: Map<string, MutableAssetBucket>): AnalysisAssetBucket[] => {
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      markets: bucket.markets.sort((left, right) => right.attributedUsd - left.attributedUsd),
    }))
    .sort((left, right) => right.valueUsd - left.valueUsd);
};

export function buildRiskAnalysis({ markets, oracleMetadataMap, exposureMetric }: BuildRiskAnalysisInput): RiskAnalysisResult {
  const rows = markets
    .map((market) => buildMarketRow(market, oracleMetadataMap, exposureMetric))
    .sort((left, right) => right.exposureUsd - left.exposureUsd);

  const oracleBuckets = new Map<string, MutableBucket>();
  const pegAssumptionBuckets = new Map<string, MutableBucket>();
  const noPegAssumptionBucket = createBucket('no-peg-assumption', 'No Assumption');
  const unknownPegRouteBucket = createBucket('unknown-peg-route', 'Unknown');
  const vaultAssumptionBuckets = new Map<string, MutableBucket>();
  const loanAssetBuckets = new Map<string, MutableAssetBucket>();
  const collateralAssetBuckets = new Map<string, MutableAssetBucket>();

  for (const row of rows) {
    const vendorLabels = row.vendorLabels.length > 0 ? row.vendorLabels : [UNKNOWN_VENDOR];
    const vendorAttribution = row.exposureUsd / vendorLabels.length;

    for (const vendorLabel of vendorLabels) {
      const bucket = oracleBuckets.get(vendorLabel) ?? createBucket(vendorLabel, vendorLabel);
      addToBucket(bucket, row, vendorAttribution);
      oracleBuckets.set(vendorLabel, bucket);
    }

    for (const assumption of row.pegAssumptions) {
      const bucket = pegAssumptionBuckets.get(assumption) ?? createBucket(assumption, assumption);
      addToBucket(bucket, row, row.exposureUsd);
      pegAssumptionBuckets.set(assumption, bucket);
    }

    const hasUnknownPegRoute = row.oracleType === 'missing' || row.unknownLegCount > 0 || row.actualPath === EMPTY_PATH;

    if (row.pegAssumptions.length === 0 && hasUnknownPegRoute) {
      addToBucket(unknownPegRouteBucket, row, row.exposureUsd);
    } else if (row.pegAssumptions.length === 0) {
      addToBucket(noPegAssumptionBucket, row, row.exposureUsd);
    }

    for (const assumption of row.vaultAssumptions) {
      const bucket = vaultAssumptionBuckets.get(assumption) ?? createBucket(assumption, assumption);
      addToBucket(bucket, row, row.exposureUsd);
      vaultAssumptionBuckets.set(assumption, bucket);
    }

    addToAssetBucket(loanAssetBuckets, row, row.market.loanAsset, row.exposureUsd);
    addToAssetBucket(collateralAssetBuckets, row, row.market.collateralAsset, row.collateralUsd);
  }

  return {
    marketCount: rows.length,
    totalSupplyUsd: rows.reduce((total, row) => total + row.supplyUsd, 0),
    totalBorrowUsd: rows.reduce((total, row) => total + row.borrowUsd, 0),
    totalCollateralUsd: rows.reduce((total, row) => total + row.collateralUsd, 0),
    totalExposureUsd: rows.reduce((total, row) => total + row.exposureUsd, 0),
    invalidPathCount: rows.filter((row) => !row.isValidPath).length,
    unknownOracleCount: rows.filter((row) => row.vendorLabels.includes(UNKNOWN_VENDOR) || row.oracleType === 'missing').length,
    rows,
    oracleBuckets: finalizeBuckets(oracleBuckets),
    pegAssumptionBuckets: finalizeBuckets(pegAssumptionBuckets),
    noPegAssumptionBucket: finalizeBuckets(new Map([[noPegAssumptionBucket.key, noPegAssumptionBucket]]))[0] ?? null,
    unknownPegRouteBucket: finalizeBuckets(new Map([[unknownPegRouteBucket.key, unknownPegRouteBucket]]))[0] ?? null,
    vaultAssumptionBuckets: finalizeBuckets(vaultAssumptionBuckets),
    loanAssetBuckets: finalizeAssetBuckets(loanAssetBuckets),
    collateralAssetBuckets: finalizeAssetBuckets(collateralAssetBuckets),
  };
}
