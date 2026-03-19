import fs from 'node:fs';
import path from 'node:path';

const MORPHO_API_URL = 'https://blue-api.morpho.org/graphql';
const DEFAULT_CHAIN_IDS = [1, 8453, 137, 130, 42161, 999, 143] as const;
const DEFAULT_PAGE_SIZES = [500, 750, 1000, 1250, 1500];
const DEFAULT_BATCH_SIZE = 4;
const DEFAULT_TIMEOUT_MS = 20_000;

type GraphQlResponse = {
  data?: {
    markets?: {
      items?: unknown[];
      pageInfo?: {
        countTotal?: number;
      };
    };
  };
  errors?: Array<{ message?: string; status?: string }>;
  extensions?: {
    complexity?: number;
  };
};

type PageResult = {
  ok: boolean;
  status: number;
  ms: number;
  itemCount: number;
  totalCount: number | null;
  complexity: number | null;
  error: string | null;
};

type PaginationBenchmarkResult = {
  pageSize: number;
  ok: boolean;
  totalMs: number;
  firstPageMs: number;
  firstPageComplexity: number | null;
  totalPages: number;
  totalItems: number;
  totalCount: number | null;
  error: string | null;
};

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIntList = (value: string | undefined, fallback: number[]): number[] => {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0);

  return parsed.length > 0 ? parsed : fallback;
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

const fetchMarketsPage = async (pageSize: number, skip: number, timeoutMs: number): Promise<PageResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(MORPHO_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: CURRENT_MARKETS_QUERY,
        variables: {
          first: pageSize,
          skip,
          where: {
            chainId_in: [...DEFAULT_CHAIN_IDS],
          },
        },
      }),
      signal: controller.signal,
    });

    const body = (await response.json()) as GraphQlResponse;
    const errorMessage =
      body.errors?.map((error) => error.message || error.status).filter(Boolean).join('; ') ||
      (!response.ok ? `HTTP ${response.status}` : null);

    return {
      ok: response.ok && !body.errors?.length,
      status: response.status,
      ms: Date.now() - startedAt,
      itemCount: body.data?.markets?.items?.length ?? 0,
      totalCount: body.data?.markets?.pageInfo?.countTotal ?? null,
      complexity: body.extensions?.complexity ?? null,
      error: errorMessage,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - startedAt,
      itemCount: 0,
      totalCount: null,
      complexity: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runPaginationBenchmark = async (
  pageSize: number,
  batchSize: number,
  timeoutMs: number,
): Promise<PaginationBenchmarkResult> => {
  const startedAt = Date.now();
  const firstPage = await fetchMarketsPage(pageSize, 0, timeoutMs);

  if (!firstPage.ok || !firstPage.totalCount) {
    return {
      pageSize,
      ok: false,
      totalMs: Date.now() - startedAt,
      firstPageMs: firstPage.ms,
      firstPageComplexity: firstPage.complexity,
      totalPages: 1,
      totalItems: firstPage.itemCount,
      totalCount: firstPage.totalCount,
      error: firstPage.error,
    };
  }

  let totalItems = firstPage.itemCount;
  let totalPages = 1;
  const offsets: number[] = [];

  for (let skip = firstPage.itemCount; skip < firstPage.totalCount; skip += pageSize) {
    offsets.push(skip);
  }

  for (let index = 0; index < offsets.length; index += batchSize) {
    const offsetBatch = offsets.slice(index, index + batchSize);
    const results = await Promise.all(offsetBatch.map((skip) => fetchMarketsPage(pageSize, skip, timeoutMs)));

    totalPages += results.length;

    for (const result of results) {
      if (!result.ok) {
        return {
          pageSize,
          ok: false,
          totalMs: Date.now() - startedAt,
          firstPageMs: firstPage.ms,
          firstPageComplexity: firstPage.complexity,
          totalPages,
          totalItems,
          totalCount: firstPage.totalCount,
          error: result.error,
        };
      }

      totalItems += result.itemCount;
    }
  }

  return {
    pageSize,
    ok: true,
    totalMs: Date.now() - startedAt,
    firstPageMs: firstPage.ms,
    firstPageComplexity: firstPage.complexity,
    totalPages,
    totalItems,
    totalCount: firstPage.totalCount,
    error: null,
  };
};

const summarizeResults = (results: PaginationBenchmarkResult[]): void => {
  console.log('\nPagination summary');
  console.log(
    [
      'page_size'.padEnd(10),
      'status'.padEnd(8),
      'total_ms'.padStart(9),
      'page1_ms'.padStart(9),
      'complex'.padStart(9),
      'pages'.padStart(7),
      'items'.padStart(7),
      'count'.padStart(7),
      'error'.padEnd(18),
    ].join(' '),
  );

  for (const result of results) {
    console.log(
      [
        `${result.pageSize}`.padEnd(10),
        (result.ok ? 'ok' : 'fail').padEnd(8),
        `${result.totalMs}`.padStart(9),
        `${result.firstPageMs}`.padStart(9),
        `${result.firstPageComplexity ?? '-'}`.padStart(9),
        `${result.totalPages}`.padStart(7),
        `${result.totalItems}`.padStart(7),
        `${result.totalCount ?? '-'}`.padStart(7),
        (result.error ?? '').slice(0, 18).padEnd(18),
      ].join(' '),
    );
  }
};

const main = async (): Promise<void> => {
  const pageSizes = toIntList(process.env.PAGE_SIZES, DEFAULT_PAGE_SIZES);
  const batchSize = toInt(process.env.BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const timeoutMs = toInt(process.env.TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const results: PaginationBenchmarkResult[] = [];

  console.log(
    `Running Morpho market pagination benchmark for page sizes ${pageSizes.join(', ')} with batch size ${batchSize}...\n`,
  );

  for (const pageSize of pageSizes) {
    const result = await runPaginationBenchmark(pageSize, batchSize, timeoutMs);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  summarizeResults(results);
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
