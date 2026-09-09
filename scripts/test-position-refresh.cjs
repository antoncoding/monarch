'use strict';
// Run with: node --test scripts/test-position-refresh.cjs
require('tsx/cjs');
// Next.js normally loads these assets, which are transitively imported by network metadata.
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: This exports an image stub, not a test module.
    module.exports = { src: '' };
  };
}

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { QueryClient } = require('@tanstack/react-query');
const { fetchLatestPositionSnapshotsWithOraclePrices } = require('../src/utils/positions');

const marketId = `0x${'1'.repeat(64)}`;
const otherMarketId = `0x${'2'.repeat(64)}`;
const user = `0x${'3'.repeat(40)}`;
const markets = [{ marketUniqueKey: marketId }];
const success = (result) => ({ status: 'success', result });
const failure = { status: 'failure', error: new Error('RPC unavailable') };
const position = success([1000000n, 0n, 0n]);
const market = success([100n, 100000000n, 0n, 0n, 1n, 0n]);
const clientWithResults = (...responses) => ({
  multicall: async () => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected extra RPC request');
    return response;
  },
});
const load = (client, inputs = markets) => fetchLatestPositionSnapshotsWithOraclePrices(inputs, user, 1, client);

test('successful balances and confirmed zero positions are retained', async () => {
  const result = await load(clientWithResults([position, success([0n, 0n, 0n])], [market]), [
    ...markets,
    { marketUniqueKey: otherMarketId },
  ]);
  assert.equal(result.snapshots.size, 2);
  assert.equal(result.snapshots.get(marketId).supplyShares, '1000000');
  assert.equal(result.snapshots.get(otherMarketId).supplyAssets, '0');
});

test('an empty discovery result needs no RPC calls', async () => {
  const result = await load(clientWithResults(), []);
  assert.equal(result.snapshots.size, 0);
});

test('transport, partial position, and market failures reject instead of returning an incomplete portfolio', async () => {
  for (const client of [
    clientWithResults(new Error('RPC unavailable')),
    clientWithResults([position, failure], [market]),
    clientWithResults([position, success([0n, 0n, 0n])], [failure]),
  ]) {
    await assert.rejects(load(client, [...markets, { marketUniqueKey: otherMarketId }]), /position balances on chain 1/);
  }
});

test('an optional oracle failure does not discard successfully read balances', async () => {
  for (const oracleResponse of [[failure], new Error('Oracle unavailable')]) {
    const result = await load(clientWithResults([position], [market], oracleResponse), [{ ...markets[0], oracleAddress: user }]);
    assert.equal(result.snapshots.size, 1);
    assert.equal(result.oraclePrices.get(marketId) ?? null, null);
  }
});

test('React Query preserves successful balances on failed refresh and recovers on retry', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queryKey = ['enhanced-positions', user];
  const fetchPositions = (client) =>
    queryClient.fetchQuery({
      queryKey,
      queryFn: async () => [...(await load(client)).snapshots.values()],
    });
  try {
    const previous = await fetchPositions(clientWithResults([position], [market]));
    await assert.rejects(fetchPositions(clientWithResults([failure])), /position balances/);
    assert.equal(queryClient.getQueryState(queryKey).status, 'error');
    assert.deepEqual(queryClient.getQueryData(queryKey), previous);
    await fetchPositions(clientWithResults([success([0n, 0n, 0n])]));
    assert.equal(queryClient.getQueryState(queryKey).status, 'success');
    assert.equal(queryClient.getQueryData(queryKey)[0].supplyShares, '0');
  } finally {
    queryClient.clear();
  }
});
