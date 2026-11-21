'use strict';
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive token list imports.
    module.exports = { src: '/test-image.png' };
  };
}
process.env.NEXT_PUBLIC_DATA_API_BASE_URL = 'https://data.example';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, mock, test } = require('node:test');
const { clearPersistedApiResponses } = require('../src/utils/persistedApiResponseCache');
const { resolveTokenInfos } = require('../src/utils/tokenMetadata');

const disk = new Map();
let storageUnavailable = false;
let readonlyTransactions = 0;
let readwriteTransactions = 0;

function request(result) {
  const pending = { result };
  queueMicrotask(() => pending.onsuccess?.());
  return pending;
}

const database = {
  close() {},
  transaction(_store, mode) {
    if (storageUnavailable) throw new Error('IndexedDB unavailable');
    if (mode === 'readonly') readonlyTransactions++;
    if (mode === 'readwrite') readwriteTransactions++;

    const transaction = {
      objectStore: () => ({
        get: (key) => request(structuredClone(disk.get(key))),
        put: (entry) => request(disk.set(entry.key, structuredClone(entry))),
        clear: () => request(disk.clear()),
      }),
    };
    queueMicrotask(() => queueMicrotask(() => transaction.oncomplete?.()));
    return transaction;
  },
};
global.window = { indexedDB: { open: () => request(database) } };

const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const mainnet = { chainId: 1, address };
const base = { chainId: 8453, address };
const tokenKey = ({ address: tokenAddress, chainId }) => `${tokenAddress}-${chainId}`;
const responseKey = ({ address: tokenAddress, chainId }) => `${chainId}:${tokenAddress}`;
const metadata = ({ address: tokenAddress, chainId }) => ({
  token: { id: tokenAddress, address: tokenAddress, name: 'Test Token', symbol: `T${chainId}`, decimals: 6 },
  isRecognized: false,
});
const tokensResponse = (tokens) =>
  Response.json({ tokens: Object.fromEntries(tokens.map((token) => [responseKey(token), metadata(token)])) });

beforeEach(async () => {
  storageUnavailable = false;
  await clearPersistedApiResponses();
  readonlyTransactions = 0;
  readwriteTransactions = 0;
});
afterEach(() => mock.restoreAll());

test('only fetches missing tokens and shares persisted entries across different batches', async () => {
  const requests = [];
  mock.method(globalThis, 'fetch', (url, init) => {
    assert.equal(url, 'https://data.example/v1/tokens/metadata');
    assert.equal(init.method, 'POST');
    const { tokens } = JSON.parse(init.body);
    requests.push(tokens);
    return tokensResponse(tokens);
  });

  await resolveTokenInfos([mainnet]);
  const mixed = await resolveTokenInfos([base, { ...mainnet, address: `0x${address.slice(2).toUpperCase()}` }]);
  assert.deepEqual(mixed.get(tokenKey(mainnet)), metadata(mainnet));
  assert.deepEqual(mixed.get(tokenKey(base)), metadata(base));
  database.onversionchange();
  assert.deepEqual(
    await resolveTokenInfos([mainnet, base]),
    new Map([
      [tokenKey(mainnet), metadata(mainnet)],
      [tokenKey(base), metadata(base)],
    ]),
  );
  assert.deepEqual(requests, [[mainnet], [base]]);
  assert.equal(readonlyTransactions, 3);
  assert.equal(readwriteTransactions, 2);
});

test('expired entries keep last-good data without extending TTL after unsuccessful refreshes', async () => {
  const time = mock.method(Date, 'now', () => 1);
  const fetch = mock.method(globalThis, 'fetch', () => tokensResponse([mainnet]));
  await resolveTokenInfos([mainnet]);

  time.mock.mockImplementation(() => 1 + 24 * 60 * 60 * 1000);
  for (const response of [new Response(null, { status: 429 }), Response.json({ tokens: null }), Response.json({ tokens: {} })]) {
    fetch.mock.mockImplementation(() => response);
    assert.deepEqual((await resolveTokenInfos([mainnet])).get(tokenKey(mainnet)), metadata(mainnet));
  }
  assert.equal(fetch.mock.callCount(), 4);
  assert.equal(readwriteTransactions, 1);

  const updated = { ...metadata(mainnet), token: { ...metadata(mainnet).token, symbol: 'NEW' } };
  fetch.mock.mockImplementation(() => Response.json({ tokens: { [responseKey(mainnet)]: updated } }));
  assert.deepEqual((await resolveTokenInfos([mainnet])).get(tokenKey(mainnet)), updated);
  assert.deepEqual((await resolveTokenInfos([mainnet])).get(tokenKey(mainnet)), updated);
  assert.equal(fetch.mock.callCount(), 5);
});

test('a malformed or absent token can be retried while a valid token on another chain is cached', async () => {
  const fetch = mock.method(globalThis, 'fetch', () =>
    Response.json({ tokens: { [responseKey(mainnet)]: metadata(mainnet), [responseKey(base)]: null } }),
  );
  const partial = await resolveTokenInfos([mainnet, base]);
  assert.deepEqual([...partial], [[tokenKey(mainnet), metadata(mainnet)]]);

  fetch.mock.mockImplementation((_url, init) => {
    assert.deepEqual(JSON.parse(init.body).tokens, [base]);
    return tokensResponse([base]);
  });
  assert.deepEqual((await resolveTokenInfos([mainnet, base])).get(tokenKey(base)), metadata(base));
  assert.equal(disk.size, 2);
});

test('the opt-out skips storage and the live lookup works without IndexedDB', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => tokensResponse([mainnet]));
  assert.equal((await resolveTokenInfos([mainnet], {}, { resolveUnknownTokens: false })).size, 0);
  assert.equal(readonlyTransactions, 0);
  assert.equal(fetch.mock.callCount(), 0);

  storageUnavailable = true;
  assert.deepEqual((await resolveTokenInfos([mainnet])).get(tokenKey(mainnet)), metadata(mainnet));
  assert.equal(disk.size, 0);
});
