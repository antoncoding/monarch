'use strict';
// Run with: node --test scripts/test-position-market-batching.cjs
require('tsx/cjs');
const memoryStorage = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => memoryStorage.set(key, value),
    removeItem: (key) => memoryStorage.delete(key),
  },
});
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '' };
  };
}
process.env.NEXT_PUBLIC_MONARCH_API_NEW = 'https://indexer.example/graphql';
process.env.NEXT_PUBLIC_DATA_API_BASE_URL = 'https://metadata.example';
const assert = require('node:assert/strict');
const { test, mock, afterEach } = require('node:test');
afterEach(() => mock.restoreAll());
const React = require('react');
const { renderToString } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { fetchMonarchMarket, fetchMonarchMarkets } = require('../src/data-sources/monarch-api/markets');
const { default: useUserPositions, fetchPositionMarketShells } = require('../src/hooks/useUserPositions');
const { getClient } = require('../src/utils/rpc');
const { infoToKey } = require('../src/utils/tokens');
const id = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const row = (n) => ({
  chainId: 1,
  marketId: id(n),
  loanToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  collateralToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  oracle: '0x1111111111111111111111111111111111111111',
  irm: '0x870ac11d48b15db9a138cf899d20f13f79ba00bc',
  lltv: '860000000000000000',
  totalSupplyAssets: '1000000',
  totalSupplyShares: '1000000000000',
  totalBorrowAssets: '500000',
  totalBorrowShares: '500000000000',
  collateralAssets: '1',
  lastUpdate: String(Math.floor(Date.now() / 1000)),
  fee: '0',
  rateAtTarget: '1000000000',
});
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const hints = (ids, chainId = 1) => ids.map((marketUniqueKey) => ({ marketUniqueKey, chainId }));

test('known position IDs use one chain-scoped request, with normalized IDs', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    return reply({ data: { Market: [row(10), row(11)] } });
  });
  const result = await fetchPositionMarketShells(hints([id(10).toUpperCase(), id(11)]), 1, {});
  assert.equal(result.length, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].variables.marketIds, [id(10), id(11)]);
  assert.equal(calls[0].variables.chainId, 1);
  assert.match(calls[0].query, /marketId: \{ _in: \$marketIds \}/);
});

test('empty IDs do not fetch; registry calls retain the unfiltered query', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return reply({ data: { Market: [] } });
  });
  assert.deepEqual(await fetchMonarchMarkets(1, {}, { marketIds: [] }), []);
  assert.equal(calls.length, 0);
  await fetchMonarchMarkets();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].variables.marketIds, undefined);
  assert.doesNotMatch(calls[0].query, /\$marketIds/);
});

test('targeted reads paginate using raw counts and isolate a malformed market state', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => row(i + 1));
  rows[5].lltv = 'invalid';
  const calls = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    const r = JSON.parse(options.body);
    calls.push(r);
    return reply({ data: { Market: rows.slice(r.variables.offset, r.variables.offset + r.variables.limit) } });
  });
  mock.method(console, 'warn', () => {});
  const markets = await fetchMonarchMarkets(1, {}, { marketIds: rows.map((r) => r.marketId) });
  assert.equal(markets.length, 1000);
  assert.deepEqual(
    calls.map((r) => r.variables.offset),
    [0, 1000],
  );
  assert.ok(markets.some((m) => m.uniqueKey === id(1001)));
  assert.ok(!markets.some((m) => m.uniqueKey === id(6)));
});

test('only missing shells use Morpho fallback; a failed fallback preserves good shells', async () => {
  const fallbackIds = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const r = JSON.parse(options.body);
    if (String(url).includes('indexer.example')) return reply({ data: { Market: [row(1)] } });
    fallbackIds.push(r.variables.uniqueKey);
    return reply({ data: { marketByUniqueKey: null } });
  });
  const result = await fetchPositionMarketShells(hints([id(1), id(2)]), 1, {});
  assert.deepEqual(
    result.map((m) => m.uniqueKey),
    [id(1)],
  );
  assert.deepEqual(fallbackIds, [id(2)]);
});

test('a failed Monarch batch still loads individual Morpho fallback shells', async () => {
  mock.method(console, 'warn', () => {});
  const fallbackIds = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const request = JSON.parse(options.body);
    if (String(url).includes('indexer.example')) return reply({ errors: [{ message: 'Indexer unavailable' }] });
    fallbackIds.push(request.variables.uniqueKey);
    return reply({
      data: {
        marketByUniqueKey: {
          uniqueKey: request.variables.uniqueKey,
          loanAsset: { address: row(1).loanToken },
          collateralAsset: { address: row(1).collateralToken },
          irmAddress: row(1).irm,
          oracle: { address: row(1).oracle },
          morphoBlue: { chain: { id: request.variables.chainId } },
          state: { apyAtTarget: 0 },
        },
      },
    });
  });
  const markets = await fetchPositionMarketShells(hints([id(1), id(2)]), 1, {});
  assert.deepEqual(
    markets.map((market) => market.uniqueKey),
    [id(1), id(2)],
  );
  assert.deepEqual(fallbackIds, [id(1), id(2)]);
});

const unknownCollateral = '0x1111111111111111111100000000000000000001';
const timestamp = 1750000000;

test('batching preserves exact single-market output and deduplicates unknown token metadata', async () => {
  mock.method(Date, 'now', () => timestamp * 1000);
  const rows = Array.from({ length: 25 }, (_, index) => ({
    ...row(index + 1),
    ...(index < 24 ? { collateralToken: unknownCollateral } : {}),
  }));
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url: String(url), request });
    if (String(url).includes('metadata.example')) {
      return reply({
        tokens: {
          [infoToKey(unknownCollateral, 1)]: {
            token: { id: unknownCollateral, address: unknownCollateral, name: 'Unknown token', symbol: 'UNK', decimals: 18 },
            isRecognized: false,
          },
        },
      });
    }
    assert.match(request.query, /chainId: \{ _eq: \$chainId \}/);
    assert.match(request.query, /collateralToken: \{ _neq: \$zeroAddress \}/);
    assert.match(request.query, /irm: \{ _neq: \$zeroAddress \}/);
    const requestedIds = request.variables.marketIds ?? [request.variables.marketId];
    return reply({ data: { Market: rows.filter((market) => requestedIds.includes(market.marketId)) } });
  });
  const original = await Promise.all(rows.map((market) => fetchMonarchMarket(market.marketId, 1)));
  const originalCalls = calls.splice(0);
  const batch = await fetchPositionMarketShells(hints(rows.map((market) => market.marketId)), 1, {});
  assert.deepEqual(batch, original);
  assert.equal(originalCalls.filter((call) => call.url.includes('indexer.example')).length, 25);
  assert.equal(originalCalls.filter((call) => call.url.includes('metadata.example')).length, 24);
  assert.equal(calls.filter((call) => call.url.includes('indexer.example')).length, 1);
  assert.equal(calls.filter((call) => call.url.includes('metadata.example')).length, 1);
  assert.deepEqual(calls.find((call) => call.url.includes('metadata.example')).request.tokens, [
    { address: unknownCollateral, chainId: 1 },
  ]);
});

test('token metadata outage preserves known shells and falls back only for the unresolved market', async () => {
  const rows = [row(1), { ...row(2), collateralToken: unknownCollateral }, row(3)];
  const fallbackIds = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const request = JSON.parse(options.body);
    if (String(url).includes('indexer.example')) return reply({ data: { Market: rows } });
    if (String(url).includes('metadata.example')) return reply({ message: 'Metadata unavailable' }, 503);
    fallbackIds.push(request.variables.uniqueKey);
    return reply({ data: { marketByUniqueKey: null } });
  });
  const markets = await fetchPositionMarketShells(hints(rows.map((market) => market.marketId)), 1, {});
  assert.deepEqual(
    markets.map((market) => market.uniqueKey),
    [id(1), id(3)],
  );
  assert.deepEqual(fallbackIds, [id(2)]);
});

function PositionQueryProbe({ marketHints, chainIds }) {
  useUserPositions('0x2222222222222222222222222222222222222222', false, chainIds, { marketHints, sourceMarketKeysProvided: true });
  return null;
}

// Server-render the hook's observer, then execute its real query with query.fetch().
// This covers query composition, not the browser UI lifecycle; only fetch and RPC are mocked.
const renderEnhancedQuery = (marketHints, chainIds) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(PositionQueryProbe, { marketHints, chainIds })));
  const query = client
    .getQueryCache()
    .getAll()
    .find((entry) => entry.queryKey[0] === 'enhanced-positions');
  return { client, query };
};

const mockSnapshots = (chainId) => {
  mock.method(getClient(chainId), 'multicall', async ({ contracts }) =>
    contracts.map(({ functionName }) => {
      switch (functionName) {
        case 'position':
          return { status: 'success', result: [1000000n, 0n, 0n] };
        case 'market':
          return { status: 'success', result: [1000000n, 1000000000000n, 0n, 0n, BigInt(timestamp), 0n] };
        case 'price':
          return { status: 'success', result: 10n ** 36n };
        default:
          return assert.fail(`Unexpected RPC function: ${functionName}`);
      }
    }),
  );
};

test('enhanced query preserves hinted shells and fetches only missing market data', async () => {
  const requests = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const requestedIds = request.variables.marketIds ?? [request.variables.marketId];
    return reply({ data: { Market: [row(1), row(2)].filter((market) => requestedIds.includes(market.marketId)) } });
  });
  const hintedMarket = await fetchMonarchMarket(id(1), 1);
  requests.length = 0;
  mockSnapshots(1);
  const hinted = { marketUniqueKey: id(1), chainId: 1, market: hintedMarket };
  const fullyHinted = renderEnhancedQuery([hinted], [1]);
  try {
    const positions = await fullyHinted.query.fetch();
    assert.equal(requests.length, 0);
    assert.strictEqual(positions[0].market, hintedMarket);
  } finally {
    fullyHinted.client.clear();
  }
  const { client, query } = renderEnhancedQuery([hinted, ...hints([id(2)])], [1]);
  try {
    const positions = await query.fetch();
    assert.deepEqual(
      requests.map((request) => request.variables.marketIds),
      [[id(2)]],
    );
    assert.deepEqual(
      positions.map((position) => position.market.uniqueKey),
      [id(1), id(2)],
    );
    assert.strictEqual(positions[0].market, hintedMarket);
    assert.equal(positions[0].state.supplyShares, '1000000');
  } finally {
    client.clear();
  }
});

test('enhanced query preserves mainnet positions when both metadata sources fail on supported Base', async () => {
  const primaryChainIds = [];
  const fallbackChainIds = [];
  mock.method(console, 'warn', () => {});
  mock.method(globalThis, 'fetch', async (url, options) => {
    const request = JSON.parse(options.body);
    if (String(url).includes('indexer.example')) {
      primaryChainIds.push(request.variables.chainId);
      return request.variables.chainId === 1 ? reply({ data: { Market: [row(1)] } }) : reply({ errors: [{ message: 'Base unavailable' }] });
    }
    fallbackChainIds.push(request.variables.chainId);
    return reply({ data: { marketByUniqueKey: null } });
  });
  mockSnapshots(1);
  mockSnapshots(8453);
  const { client, query } = renderEnhancedQuery([...hints([id(1)], 1), ...hints([id(1)], 8453)], [1, 8453]);
  try {
    const positions = await query.fetch();
    assert.deepEqual(primaryChainIds, [1, 8453]);
    assert.deepEqual(fallbackChainIds, [8453]);
    assert.equal(positions.length, 1);
    assert.equal(positions[0].market.morphoBlue.chain.id, 1);
    assert.equal(query.state.status, 'success');
  } finally {
    client.clear();
  }
});
