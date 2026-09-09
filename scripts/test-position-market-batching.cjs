'use strict';
// Run with: node --test scripts/test-position-market-batching.cjs
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '' };
  };
}
process.env.NEXT_PUBLIC_MONARCH_API_NEW = 'https://indexer.example/graphql';
const assert = require('node:assert/strict');
const { test, mock, afterEach } = require('node:test');
afterEach(() => mock.restoreAll());
const { fetchMonarchMarkets } = require('../src/data-sources/monarch-api/markets');
const { fetchPositionMarketShells } = require('../src/hooks/useUserPositions');
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
const reply = (body) => new Response(JSON.stringify(body), { status: 200 });
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

test('an unavailable secondary chain does not reject healthy mainnet shells', async () => {
  mock.method(console, 'warn', () => {});
  mock.method(globalThis, 'fetch', async (_url, options) => {
    const r = JSON.parse(options.body);
    return r.variables.chainId === 1 ? reply({ data: { Market: [row(1)] } }) : reply({ errors: [{ message: 'Chain source unavailable' }] });
  });
  const [mainnet, secondary] = await Promise.all([
    fetchPositionMarketShells(hints([id(1)]), 1, {}),
    fetchPositionMarketShells(hints([id(1)], 42793), 42793, {}),
  ]);
  assert.equal(mainnet.length, 1);
  assert.deepEqual(secondary, []);
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
