import fs from 'node:fs';
import path from 'node:path';

const MORPHO_API_URL = 'https://blue-api.morpho.org/graphql';
const DEFAULT_CHAIN_IDS = [1, 8453, 137, 130, 42161, 999, 143] as const;
const DEFAULT_SAMPLES = 2;
const DEFAULT_PAGE_SIZE = 500;

type BenchmarkCase = {
  name: string;
  query: string;
  variables: Record<string, unknown>;
};

type GraphQlResponse = {
  data?: unknown;
  errors?: Array<{ message?: string; status?: string }>;
  extensions?: {
    complexity?: number;
    maximumComplexity?: number;
  };
};

type BenchmarkResult = {
  name: string;
  sample: number;
  status: number;
  ms: number;
  bytes: number;
  complexity: number | null;
  countTotal: number | null;
  itemCount: number | null;
  error: string | null;
};

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readCurrentMarketsQuery = (): string => {
  const filePath = path.join(process.cwd(), 'src/graphql/morpho-api-queries.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/export const marketsQuery = `([\s\S]*?)`;/);

  if (!match?.[1]) {
    throw new Error('Unable to locate marketsQuery in src/graphql/morpho-api-queries.ts');
  }

  return match[1];
};

const CURRENT_MARKETS_QUERY = readCurrentMarketsQuery();

const GROUPED_MARKETS_QUERY = `
  query BenchmarkMarkets(
    $first: Int
    $skip: Int
    $where: MarketFilters
    $includeAssets: Boolean!
    $includeCoreState: Boolean!
    $includeRateHistory: Boolean!
    $includeOracleAddress: Boolean!
    $includeWarnings: Boolean!
    $includeBadDebt: Boolean!
    $includeSupplyingVaults: Boolean!
  ) {
    markets(first: $first, skip: $skip, where: $where) {
      items {
        uniqueKey
        listed
        lltv
        morphoBlue {
          chain {
            id
          }
        }
        loanAsset @include(if: $includeAssets) {
          address
          symbol
          decimals
        }
        collateralAsset @include(if: $includeAssets) {
          address
          symbol
          decimals
        }
        state @include(if: $includeCoreState) {
          borrowAssets
          supplyAssets
          borrowAssetsUsd
          supplyAssetsUsd
          liquidityAssets
          liquidityAssetsUsd
          collateralAssets
          collateralAssetsUsd
          utilization
          supplyApy
          borrowApy
          fee
          timestamp
        }
        rateHistory: state @include(if: $includeRateHistory) {
          apyAtTarget
          dailySupplyApy
          dailyBorrowApy
          weeklySupplyApy
          weeklyBorrowApy
          monthlySupplyApy
          monthlyBorrowApy
        }
        oracle @include(if: $includeOracleAddress) {
          address
        }
        warnings @include(if: $includeWarnings) {
          type
          level
          __typename
        }
        realizedBadDebt @include(if: $includeBadDebt) {
          underlying
          usd
        }
        badDebt @include(if: $includeBadDebt) {
          underlying
          usd
        }
        supplyingVaults @include(if: $includeSupplyingVaults) {
          address
        }
      }
      pageInfo {
        countTotal
        count
        limit
        skip
      }
    }
  }
`;

const createBaseVariables = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  first: DEFAULT_PAGE_SIZE,
  skip: 0,
  where: {
    chainId_in: [...DEFAULT_CHAIN_IDS],
  },
  ...overrides,
});

const FIELD_GROUP_CASES: BenchmarkCase[] = [
  {
    name: 'identity-only',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: false,
      includeCoreState: false,
      includeRateHistory: false,
      includeOracleAddress: false,
      includeWarnings: false,
      includeBadDebt: false,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'identity+assets',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: false,
      includeRateHistory: false,
      includeOracleAddress: false,
      includeWarnings: false,
      includeBadDebt: false,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'table-core',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: true,
      includeRateHistory: false,
      includeOracleAddress: true,
      includeWarnings: false,
      includeBadDebt: false,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'table-core+rate-history',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: true,
      includeRateHistory: true,
      includeOracleAddress: true,
      includeWarnings: false,
      includeBadDebt: false,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'table-core+warnings',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: true,
      includeRateHistory: false,
      includeOracleAddress: true,
      includeWarnings: true,
      includeBadDebt: false,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'table-core+bad-debt',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: true,
      includeRateHistory: false,
      includeOracleAddress: true,
      includeWarnings: false,
      includeBadDebt: true,
      includeSupplyingVaults: false,
    }),
  },
  {
    name: 'table-core+supplying-vaults',
    query: GROUPED_MARKETS_QUERY,
    variables: createBaseVariables({
      includeAssets: true,
      includeCoreState: true,
      includeRateHistory: false,
      includeOracleAddress: true,
      includeWarnings: false,
      includeBadDebt: false,
      includeSupplyingVaults: true,
    }),
  },
  {
    name: 'current-query',
    query: CURRENT_MARKETS_QUERY,
    variables: createBaseVariables(),
  },
];

const OFFSET_CASES: BenchmarkCase[] = [0, 500, 1000, 4000, 5000].map((skip) => ({
  name: `offset-current-skip-${skip}`,
  query: CURRENT_MARKETS_QUERY,
  variables: createBaseVariables({ skip }),
}));

const LISTED_CASES: BenchmarkCase[] = [0, 500].map((skip) => ({
  name: `listed-current-skip-${skip}`,
  query: CURRENT_MARKETS_QUERY,
  variables: createBaseVariables({
    skip,
    where: {
      chainId_in: [...DEFAULT_CHAIN_IDS],
      listed: true,
    },
  }),
}));

const runCase = async (benchmarkCase: BenchmarkCase, sample: number): Promise<BenchmarkResult> => {
  const startedAt = Date.now();
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: benchmarkCase.query,
      variables: benchmarkCase.variables,
    }),
  });
  const text = await response.text();
  const elapsedMs = Date.now() - startedAt;

  let body: GraphQlResponse | null = null;
  try {
    body = JSON.parse(text) as GraphQlResponse;
  } catch {
    body = null;
  }

  const markets = (body?.data as { markets?: { items?: unknown[]; pageInfo?: { countTotal?: number } } } | undefined)?.markets;
  const errorMessage =
    body?.errors?.map((error) => error.message || error.status).filter(Boolean).join('; ') ||
    (!response.ok ? `HTTP ${response.status}` : null);

  return {
    name: benchmarkCase.name,
    sample,
    status: response.status,
    ms: elapsedMs,
    bytes: text.length,
    complexity: body?.extensions?.complexity ?? null,
    countTotal: markets?.pageInfo?.countTotal ?? null,
    itemCount: markets?.items?.length ?? null,
    error: errorMessage,
  };
};

const summarizeResults = (results: BenchmarkResult[]): void => {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.name) ?? [];
    existing.push(result);
    grouped.set(result.name, existing);
  }

  console.log('\nBenchmark summary');
  console.log(
    [
      'case'.padEnd(28),
      'status'.padEnd(8),
      'avg_ms'.padStart(8),
      'min_ms'.padStart(8),
      'max_ms'.padStart(8),
      'avg_kb'.padStart(8),
      'items'.padStart(8),
      'count'.padStart(8),
      'complex'.padStart(8),
      'error'.padEnd(12),
    ].join(' '),
  );

  for (const [name, samples] of grouped.entries()) {
    const avgMs = Math.round(samples.reduce((sum, sample) => sum + sample.ms, 0) / samples.length);
    const minMs = Math.min(...samples.map((sample) => sample.ms));
    const maxMs = Math.max(...samples.map((sample) => sample.ms));
    const avgBytes = Math.round(samples.reduce((sum, sample) => sum + sample.bytes, 0) / samples.length / 1024);
    const first = samples[0];
    console.log(
      [
        name.padEnd(28),
        `${first.status}`.padEnd(8),
        `${avgMs}`.padStart(8),
        `${minMs}`.padStart(8),
        `${maxMs}`.padStart(8),
        `${avgBytes}`.padStart(8),
        `${first.itemCount ?? '-'}`.padStart(8),
        `${first.countTotal ?? '-'}`.padStart(8),
        `${first.complexity ?? '-'}`.padStart(8),
        (first.error ?? '').slice(0, 12).padEnd(12),
      ].join(' '),
    );
  }
};

const main = async (): Promise<void> => {
  const samples = toInt(process.env.SAMPLES, DEFAULT_SAMPLES);
  const cases = [...FIELD_GROUP_CASES, ...OFFSET_CASES, ...LISTED_CASES];
  const results: BenchmarkResult[] = [];

  console.log(`Running ${cases.length} Morpho market benchmark cases with ${samples} sample(s) each...\n`);

  for (const benchmarkCase of cases) {
    for (let sample = 1; sample <= samples; sample += 1) {
      const result = await runCase(benchmarkCase, sample);
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }

  summarizeResults(results);
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
