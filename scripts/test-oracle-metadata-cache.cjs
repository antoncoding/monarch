'use strict';
// Run with: node --test scripts/test-oracle-metadata-cache.cjs
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '' };
  };
}
process.env.NEXT_PUBLIC_ORACLE_GIST_BASE_URL = 'https://metadata.example';
const assert = require('node:assert/strict');
const { test, mock, afterEach } = require('node:test');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { QueryClient, QueryClientProvider, onlineManager } = require('@tanstack/react-query');
const { usePersistedApiResponse } = require('../src/hooks/usePersistedApiResponse');
const { useOracleMetadata, getOracleMetadataKey } = require('../src/hooks/useOracleMetadata');
const {
  createPersistedApiResponseKey,
  readPersistedApiResponse,
  writePersistedApiResponse,
} = require('../src/utils/persistedApiResponseCache');

const records = new Map();
let reads = 0;
let writes = 0;
let storageUnavailable = false;
const request = (result) => {
  const pending = {};
  queueMicrotask(() => {
    pending.result = result;
    pending.onsuccess();
  });
  return pending;
};
const database = {
  objectStoreNames: { contains: () => true },
  close() {},
  transaction() {
    if (storageUnavailable) throw new Error('Storage unavailable');
    return {
      objectStore: () => ({
        get(key) {
          reads++;
          return request(structuredClone(records.get(key)));
        },
        put(value) {
          writes++;
          records.set(value.key, structuredClone(value));
          return request(value.key);
        },
      }),
    };
  },
};
global.window = { indexedDB: { open: () => request(database) } };
const clients = [];
const newClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return client;
};
afterEach(() => {
  mock.restoreAll();
  for (const client of clients.splice(0)) client.clear();
  records.clear();
  reads = 0;
  writes = 0;
  storageUnavailable = false;
  onlineManager.setOnline(true);
});

function CacheProbe({ cacheKey, results }) {
  results.push(usePersistedApiResponse(cacheKey));
  return null;
}
function OracleProbe({ chainId, results }) {
  results.push(useOracleMetadata(chainId));
  return null;
}
const renderProbes = (client, Probe, props, count = 1) => {
  const results = [];
  renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      Array.from({ length: count }, (_, index) => React.createElement(Probe, { ...props, results, key: index })),
    ),
  );
  return results;
};
const cacheQuery = (client) => client.getQueryCache().find({ queryKey: ['persisted-api-response'], exact: false });
const oracleQuery = (client, chainId) =>
  client.getQueryCache().find({ queryKey: ['oracle-metadata', 'https://metadata.example', chainId], exact: true });
const cacheKeyForChain = (chainId) => createPersistedApiResponseKey('oracle-metadata:v1', ['https://metadata.example', chainId]);
const oracleAddress = '0x1111111111111111111111111111111111111111';
const metadata = (chainId) => ({
  version: '1.0.0',
  generatedAt: '2026-09-25T00:00:00.000Z',
  chainId,
  oracles: [{ address: oracleAddress, chainId, type: 'standard', data: {} }],
});
const hydrateOracle = async (client, chainId) => {
  renderProbes(client, OracleProbe, { chainId });
  await cacheQuery(client).fetch();
  return renderProbes(client, OracleProbe, { chainId })[0];
};

test('50 consumers share one database read and one write per response timestamp', async () => {
  const client = newClient();
  records.set('shared', { key: 'shared', data: { value: 'saved' }, updatedAt: 1 });
  renderProbes(client, CacheProbe, { cacheKey: 'shared' }, 50);
  assert.equal(client.getQueryCache().getAll().length, 1);
  await Promise.all(Array.from({ length: 50 }, () => cacheQuery(client).fetch()));
  const consumers = renderProbes(client, CacheProbe, { cacheKey: 'shared' }, 50);
  assert.equal(reads, 1);
  for (const consumer of consumers) {
    assert.equal(consumer.isReady, true);
    assert.equal(consumer.entry.data.value, 'saved');
    consumer.write({ data: { value: 'fresh' }, updatedAt: 2 });
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes, 1);
  assert.equal(records.get('shared').data.value, 'fresh');
  consumers[0].write({ data: { value: 'older' }, updatedAt: 1 });
  assert.equal(writes, 1);
  assert.equal(renderProbes(client, CacheProbe, { cacheKey: 'shared' })[0].entry.data.value, 'fresh');
});

test('a fresh page restores cached oracle classifications without a network request', async () => {
  const firstClient = newClient();
  const key = cacheKeyForChain(1);
  renderProbes(firstClient, CacheProbe, { cacheKey: key });
  await cacheQuery(firstClient).fetch();
  renderProbes(firstClient, CacheProbe, { cacheKey: key })[0].write({ data: metadata(1), updatedAt: Date.now() });
  await new Promise((resolve) => setImmediate(resolve));
  mock.method(globalThis, 'fetch', () => assert.fail('Fresh cached data must not fetch'));
  const clientAfterReload = newClient();
  const result = await hydrateOracle(clientAfterReload, 1);
  assert.equal(result.isLoading, false);
  assert.equal(result.data[oracleAddress].type, 'standard');
  assert.equal(oracleQuery(clientAfterReload, 1).isStaleByTime(30 * 60 * 1000), false);
});

test('browser cache remains readable offline and chain cache keys stay separate', async () => {
  onlineManager.setOnline(false);
  const client = newClient();
  records.set('base', { key: 'base', data: metadata(8453), updatedAt: 1 });
  renderProbes(client, CacheProbe, { cacheKey: 'base' });
  assert.equal(cacheQuery(client).options.networkMode, 'always');
  await cacheQuery(client).fetch();
  assert.equal(renderProbes(client, CacheProbe, { cacheKey: 'base' })[0].entry.data.chainId, 8453);
  const mainnet = renderProbes(client, CacheProbe, { cacheKey: 'mainnet' })[0];
  assert.equal(mainnet.isReady, false);
  assert.equal(mainnet.entry, null);
  assert.notEqual(cacheKeyForChain(1), cacheKeyForChain(8453));
  assert.notEqual(getOracleMetadataKey(1, oracleAddress), getOracleMetadataKey(8453, oracleAddress));
});

test('unavailable browser storage does not prevent live oracle loading', async () => {
  storageUnavailable = true;
  assert.equal(await readPersistedApiResponse('missing'), null);
  assert.equal(await writePersistedApiResponse('missing', { data: {}, updatedAt: 1 }), false);
  const client = newClient();
  const initial = await hydrateOracle(client, 1);
  assert.equal(initial.isLoading, true);
  mock.method(globalThis, 'fetch', async () => Response.json(metadata(1)));
  await oracleQuery(client, 1).fetch();
  const result = renderProbes(client, OracleProbe, { chainId: 1 })[0];
  assert.equal(result.isLoading, false);
  assert.equal(result.data[oracleAddress].type, 'standard');
});

for (const status of [404, 503]) {
  test(`HTTP ${status} preserves cached metadata and reports a failed refresh`, async () => {
    const client = newClient();
    const key = cacheKeyForChain(1);
    records.set(key, { key, data: metadata(1), updatedAt: 1 });
    await hydrateOracle(client, 1);
    mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    const query = oracleQuery(client, 1);
    await assert.rejects(query.fetch(), new RegExp(String(status)));
    const result = renderProbes(client, OracleProbe, { chainId: 1 })[0];
    assert.equal(result.isRefetchError, true);
    assert.equal(result.data[oracleAddress].type, 'standard');
    assert.equal(query.state.dataUpdatedAt, 1);
  });
}

test('a failed cold request is an error, not a successful empty metadata cache', async () => {
  const client = newClient();
  await hydrateOracle(client, 8453);
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  const query = oracleQuery(client, 8453);
  await assert.rejects(query.fetch(), /Failed to fetch/);
  assert.equal(query.state.status, 'error');
  assert.equal(query.state.data, undefined);
  assert.equal(query.state.dataUpdatedAt, 0);
});

test('market details distinguish loading and unavailable metadata from a custom oracle', async () => {
  // JSX uses the classic runtime in this standalone Node harness.
  global.React = React;
  const { OracleTypeInfo } = require('../src/features/markets/components/oracle/MarketOracle/OracleTypeInfo');
  const client = newClient();
  const render = () =>
    renderToString(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(OracleTypeInfo, {
          chainId: 1,
          oracleAddress,
          showCustom: true,
        }),
      ),
    );
  const loading = render();
  assert.match(loading, /Loading oracle/);
  assert.doesNotMatch(loading, /Custom Oracle|custom oracle implementation/);
  await hydrateOracle(client, 1);
  mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(oracleQuery(client, 1).fetch());
  // Each server render mounts a new observer; inspect the settled error without a mount retry.
  client.setQueryDefaults(['oracle-metadata'], { retryOnMount: false });
  const unavailable = render();
  assert.match(unavailable, /Oracle metadata unavailable/);
  assert.doesNotMatch(unavailable, /Custom Oracle|custom oracle implementation/);
});
