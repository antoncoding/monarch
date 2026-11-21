'use strict';
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive token list imports.
    module.exports = { src: '/test-image.png' };
  };
}
process.env.NEXT_PUBLIC_DATA_API_BASE_URL = 'https://data.example';
process.env.NEXT_PUBLIC_MONARCH_API_NEW = 'https://monarch.example';

const assert = require('node:assert/strict');
const { afterEach, beforeEach, mock, test } = require('node:test');
const { fetchMonarchMarket, fetchMonarchMarkets } = require('../src/data-sources/monarch-api/markets');
const { clearPersistedApiResponses } = require('../src/utils/persistedApiResponseCache');
const { resolveTokenInfos, TokenMetadataUnavailableError } = require('../src/utils/tokenMetadata');

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
const metadataWithoutDecimals = (token) => ({ ...metadata(token), token: { ...metadata(token).token, decimals: undefined } });

const marketRow = ({ chainId, address: collateralToken }) => ({
  chainId,
  marketId: `0x${chainId.toString(16).padStart(64, '0')}`,
  loanToken: chainId === 1 ? '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' : '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  collateralToken,
  oracle: '0x1111111111111111111111111111111111111111',
  irm: '0x2222222222222222222222222222222222222222',
  lltv: '860000000000000000',
  totalSupplyAssets: '10000',
  totalBorrowAssets: '5000',
  totalSupplyShares: '10000000',
  totalBorrowShares: '5000000',
  collateralAssets: '10000',
  lastUpdate: '1750000000',
  fee: '0',
  rateAtTarget: '0',
});

const mockMarketRegistry = (rows, getTokenResponse) =>
  mock.method(globalThis, 'fetch', (url) =>
    url === 'https://monarch.example' ? Response.json({ data: { Market: rows } }) : getTokenResponse(),
  );

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
  assert.deepEqual(mixed.tokenInfos.get(tokenKey(mainnet)), metadata(mainnet));
  assert.deepEqual(mixed.tokenInfos.get(tokenKey(base)), metadata(base));
  assert.equal(mixed.unavailableTokenKeys.size, 0);
  database.onversionchange();
  assert.deepEqual(
    (await resolveTokenInfos([mainnet, base])).tokenInfos,
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
  const dayMs = 24 * 60 * 60 * 1000;
  const time = mock.method(Date, 'now', () => 1);
  const fetch = mock.method(globalThis, 'fetch', () => tokensResponse([mainnet]));
  await resolveTokenInfos([mainnet]);

  time.mock.mockImplementation(() => 1 + 3 * dayMs);
  assert.deepEqual((await resolveTokenInfos([mainnet])).tokenInfos.get(tokenKey(mainnet)), metadata(mainnet));
  assert.equal(fetch.mock.callCount(), 1);

  time.mock.mockImplementation(() => 1 + 7 * dayMs);
  for (const response of [new Response(null, { status: 429 }), Response.json({ tokens: null })]) {
    fetch.mock.mockImplementation(() => response);
    const degraded = await resolveTokenInfos([mainnet]);
    assert.deepEqual(degraded.tokenInfos.get(tokenKey(mainnet)), metadata(mainnet));
    assert.deepEqual([...degraded.unavailableTokenKeys], [tokenKey(mainnet)]);
  }
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(readwriteTransactions, 1);

  const updated = { ...metadata(mainnet), token: { ...metadata(mainnet).token, symbol: 'NEW' } };
  fetch.mock.mockImplementation(() => Response.json({ tokens: { [responseKey(mainnet)]: updated } }));
  assert.deepEqual((await resolveTokenInfos([mainnet])).tokenInfos.get(tokenKey(mainnet)), updated);
  assert.deepEqual((await resolveTokenInfos([mainnet])).tokenInfos.get(tokenKey(mainnet)), updated);
  assert.equal(fetch.mock.callCount(), 4);
});

test('a raw record without decimals is unavailable while valid metadata on another chain is cached', async () => {
  const fetch = mock.method(globalThis, 'fetch', () =>
    Response.json({ tokens: { [responseKey(mainnet)]: metadata(mainnet), [responseKey(base)]: metadataWithoutDecimals(base) } }),
  );
  const partial = await resolveTokenInfos([mainnet, base]);
  assert.deepEqual([...partial.tokenInfos], [[tokenKey(mainnet), metadata(mainnet)]]);
  assert.deepEqual([...partial.unavailableTokenKeys], [tokenKey(base)]);

  fetch.mock.mockImplementation((_url, init) => {
    assert.deepEqual(JSON.parse(init.body).tokens, [base]);
    return tokensResponse([base]);
  });
  assert.deepEqual((await resolveTokenInfos([mainnet, base])).tokenInfos.get(tokenKey(base)), metadata(base));
  assert.equal(disk.size, 2);
});

test('a rejected batch reports its token keys while a successful batch on another chain is retained', async () => {
  const firstBatch = [
    mainnet,
    ...Array.from({ length: 199 }, (_, index) => ({ chainId: 1, address: `0x${(index + 256).toString(16).padStart(40, 'c')}` })),
  ];
  mock.method(globalThis, 'fetch', (_url, init) => {
    const { tokens } = JSON.parse(init.body);
    return tokens[0].chainId === 1 ? tokensResponse([mainnet]) : new Response(null, { status: 503 });
  });

  const { tokenInfos, unavailableTokenKeys } = await resolveTokenInfos([...firstBatch, base]);
  assert.deepEqual([...tokenInfos], [[tokenKey(mainnet), metadata(mainnet)]]);
  assert.deepEqual([...unavailableTokenKeys], [tokenKey(base)]);
});

test('a cold malformed response rejects at the market fetcher while a valid sparse response can be empty', async () => {
  let tokenResponse = () => Response.json({ tokens: { [responseKey(mainnet)]: metadataWithoutDecimals(mainnet) } });
  const row = marketRow(mainnet);
  mockMarketRegistry([row], () => tokenResponse());
  await assert.rejects(fetchMonarchMarkets(), TokenMetadataUnavailableError);
  await assert.rejects(fetchMonarchMarket(row.marketId, mainnet.chainId), TokenMetadataUnavailableError);
  assert.equal(disk.size, 0);

  tokenResponse = () => Response.json({ tokens: {} });
  assert.deepEqual(await fetchMonarchMarkets(), { markets: [], tokenMetadataUnavailable: false });
  assert.equal(await fetchMonarchMarket(row.marketId, mainnet.chainId), null);
});

test('the registry preserves valid markets and recovers a previous market when its token lookup fails', async () => {
  let tokenResponse = () => tokensResponse([mainnet, base]);
  const rows = [marketRow(mainnet), marketRow(base)];
  mockMarketRegistry(rows, () => tokenResponse());
  const complete = await fetchMonarchMarkets();
  assert.equal(complete.markets.length, 2);

  // Simulate an existing market cache with no individual token records.
  await clearPersistedApiResponses();
  tokenResponse = () => Response.json({ tokens: { [responseKey(mainnet)]: metadata(mainnet), [responseKey(base)]: null } });
  const degraded = await fetchMonarchMarkets(undefined, {}, { previousMarkets: complete.markets });
  assert.equal(degraded.tokenMetadataUnavailable, true);
  assert.equal(degraded.markets[1], complete.markets[1]);
  assert.equal(degraded.markets[0].uniqueKey, rows[0].marketId);
  assert.equal(disk.size, 1);

  const coldPartial = await fetchMonarchMarkets();
  assert.equal(coldPartial.tokenMetadataUnavailable, true);
  assert.deepEqual(
    coldPartial.markets.map((market) => market.uniqueKey),
    [rows[0].marketId],
  );

  tokenResponse = () => tokensResponse([mainnet]);
  const sparse = await fetchMonarchMarkets(undefined, {}, { previousMarkets: complete.markets });
  assert.equal(sparse.tokenMetadataUnavailable, false);
  assert.deepEqual(
    sparse.markets.map((market) => market.uniqueKey),
    [rows[0].marketId],
  );
});

test('the opt-out skips storage and the live lookup works without IndexedDB', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => tokensResponse([mainnet]));
  assert.equal((await resolveTokenInfos([mainnet], {}, { resolveUnknownTokens: false })).tokenInfos.size, 0);
  assert.equal(readonlyTransactions, 0);
  assert.equal(fetch.mock.callCount(), 0);

  storageUnavailable = true;
  assert.deepEqual((await resolveTokenInfos([mainnet])).tokenInfos.get(tokenKey(mainnet)), metadata(mainnet));
  assert.equal(disk.size, 0);
});
