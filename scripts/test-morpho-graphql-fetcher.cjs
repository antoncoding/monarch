// biome-ignore-all lint/style/noDoneCallback: node:test passes TestContext, not a completion callback.
'use strict';
require('tsx/cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { morphoGraphqlFetcher } = require('../src/data-sources/morpho-api/fetchers');

const query = 'query User { userByAddress(address: "0x0000000000000000000000000000000000123456", chainId: 1) { address } }';
function respond(t, payload, status = 200) {
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload, { status }));
}

test('only confirmed NOT_FOUND without data normalizes to null', async (t) => {
  respond(t, { data: null, errors: [{ status: 'NOT_FOUND', message: 'User not found' }] });
  assert.equal(await morphoGraphqlFetcher(query, {}), null);
});

test('explicit null entities and valid empty collections remain successful data', async (t) => {
  const payload = { data: { userByAddress: null, positions: [] } };
  respond(t, payload);
  assert.deepEqual(await morphoGraphqlFetcher(query, {}), payload);
});

test('NOT_FOUND on one field preserves partial data from other fields', async (t) => {
  const payload = { data: { missing: null, found: { address: '0x1' } }, errors: [{ status: 'NOT_FOUND', path: ['missing'] }] };
  respond(t, payload);
  assert.deepEqual(await morphoGraphqlFetcher(query, {}), payload);
});

test('a NOT_FOUND error cannot hide another GraphQL failure, with or without partial data', async (t) => {
  t.mock.method(console, 'error', () => {});
  let data = null;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ data, errors: [{ status: 'NOT_FOUND' }, { status: 'INTERNAL_SERVER_ERROR', message: 'Indexer unavailable' }] }),
  );
  await assert.rejects(morphoGraphqlFetcher(query, {}), /Indexer unavailable/);
  data = { missing: null, found: { address: '0x1' } };
  await assert.rejects(morphoGraphqlFetcher(query, {}), /Indexer unavailable/);
});

test('raw JSON null or a missing/invalid data envelope is malformed, not confirmed absence', async (t) => {
  let payload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  for (const value of [null, {}, { data: null }, { data: [] }, []]) {
    payload = value;
    await assert.rejects(morphoGraphqlFetcher(query, {}), /Invalid.*Morpho API/);
  }
});

test('HTTP failures reject instead of becoming an empty result', async (t) => {
  respond(t, { message: 'Service unavailable' }, 503);
  await assert.rejects(morphoGraphqlFetcher(query, {}), /503/);
});

test('network and JSON decoding failures propagate', async (t) => {
  const failure = new Error('Network unavailable');
  t.mock.method(globalThis, 'fetch', async () => {
    throw failure;
  });
  await assert.rejects(morphoGraphqlFetcher(query, {}), failure);
  t.mock.method(globalThis, 'fetch', async () => new Response('invalid JSON'));
  await assert.rejects(morphoGraphqlFetcher(query, {}), SyntaxError);
});

test('request timeout rejects instead of becoming not found', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    (_, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
  );
  await assert.rejects(morphoGraphqlFetcher(query, {}, { timeoutMs: 1 }), /timeout after 1ms/);
});
