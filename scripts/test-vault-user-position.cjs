// biome-ignore-all lint/style/noDoneCallback: node:test passes TestContext, not a completion callback.
'use strict';
// Run with: node --test scripts/test-vault-user-position.cjs
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '/test-image.png', width: 16, height: 16 };
  };
}
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  configurable: true,
});
const { useVaultUserPositionQuery } = require('../src/hooks/queries/useVaultUserPositionQuery');
const { refetchVaultQueryData } = require('../src/hooks/useVaultQueryRefresh');
const { getClient } = require('../src/utils/rpc');

// Reported mainnet vault and a depositor who is not the vault owner.
const vaultAddress = '0x582cB3e2710e0975343CE8D749b46f614E94466b';
const userAddress = '0x0b2f3c85811018c8226033d209f8cfa0b0ae6868';
const otherUser = '0x7ee567d2ac5dca4c422281deb1e2334a805ba6c1';
const positionArgs = { vaultAddress, chainId: 1, userAddress };

function createQueryClient(t) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  t.after(() => client.clear());
  return client;
}

function readPosition(client, args = positionArgs) {
  let result;
  function Position() {
    result = useVaultUserPositionQuery(args);
    return null;
  }
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Position)));
  const query = client.getQueryCache().find({
    queryKey: ['vault-user-position', args.vaultAddress?.toLowerCase(), args.chainId, args.userAddress?.toLowerCase()],
    exact: false,
  });
  return { query, result };
}

test('opened vault resolves a non-owner position directly and uses the vault preview for asset value', async (t) => {
  const shares = 5961491832005351266095n;
  const assets = 6123456789n;
  const reads = t.mock.method(getClient(1), 'readContract', async ({ address, functionName, args }) => {
    assert.equal(address, vaultAddress.toLowerCase());
    if (functionName === 'balanceOf') {
      assert.deepEqual(args, [userAddress]);
      return shares;
    }
    assert.equal(functionName, 'previewRedeem');
    assert.deepEqual(args, [shares]);
    return assets;
  });
  const client = createQueryClient(t);
  const { query } = readPosition(client);
  await query.fetch();
  assert.deepEqual(readPosition(client).result.data, { shares, assets });
  assert.equal(reads.mock.callCount(), 2);
});

test('a confirmed empty position skips conversion', async (t) => {
  const reads = t.mock.method(getClient(1), 'readContract', async ({ functionName }) => {
    assert.equal(functionName, 'balanceOf');
    return 0n;
  });
  const { query } = readPosition(createQueryClient(t));
  await query.fetch();
  assert.deepEqual(query.state.data, { shares: 0n, assets: 0n });
  assert.equal(reads.mock.callCount(), 1);
});

test('missing wallet or vault disables the position query', (t) => {
  const client = createQueryClient(t);
  for (const args of [
    { ...positionArgs, userAddress: undefined },
    { ...positionArgs, vaultAddress: undefined },
  ]) {
    const { query, result } = readPosition(client, args);
    assert.equal(query.options.enabled, false);
    assert.equal(result.isLoading, false);
    assert.equal(result.data, undefined);
  }
});

test('failed balance and conversion reads report errors rather than a zero position', async (t) => {
  for (const failingRead of ['balanceOf', 'previewRedeem']) {
    const read = t.mock.method(getClient(1), 'readContract', async ({ functionName }) => {
      if (functionName === failingRead) throw new Error('RPC unavailable');
      return 10n;
    });
    const client = createQueryClient(t);
    const { query } = readPosition(client);
    await assert.rejects(query.fetch(), /RPC unavailable/);
    assert.equal(query.state.status, 'error');
    assert.equal(query.state.data, undefined);
    read.mock.restore();
  }
});

test('a failed refresh retains the confirmed position and surfaces the error', async (t) => {
  const client = createQueryClient(t);
  const { query } = readPosition(client);
  const confirmed = { shares: 100n, assets: 105n };
  client.setQueryData(query.queryKey, confirmed);
  t.mock.method(getClient(1), 'readContract', async () => {
    throw new Error('RPC unavailable');
  });
  await assert.rejects(query.fetch(), /RPC unavailable/);
  const { result } = readPosition(client);
  assert.deepEqual(result.data, confirmed);
  assert.equal(result.isRefetchError, true);
});

test('wallet, chain, and vault changes cannot reuse another position', (t) => {
  const client = createQueryClient(t);
  const { query } = readPosition(client);
  client.setQueryData(query.queryKey, { shares: 100n, assets: 105n });
  for (const args of [
    { ...positionArgs, userAddress: otherUser },
    { ...positionArgs, chainId: 8453 },
    { ...positionArgs, vaultAddress: otherUser },
    { ...positionArgs, userAddress: undefined },
  ]) {
    assert.equal(readPosition(client, args).result.data, undefined);
  }
  assert.equal(readPosition(client, { ...positionArgs, vaultAddress: vaultAddress.toLowerCase() }).query, query);
});

test('shared vault refresh updates the opened position after a deposit or withdrawal', async (t) => {
  const client = createQueryClient(t);
  const { query } = readPosition(client);
  client.setQueryData(query.queryKey, { shares: 100n, assets: 105n });
  t.mock.method(getClient(1), 'readContract', async () => 0n);
  await refetchVaultQueryData(client, { vaultAddress, chainId: 1 });
  assert.deepEqual(query.state.data, { shares: 0n, assets: 0n });
});
