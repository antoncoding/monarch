// biome-ignore-all lint/style/noDoneCallback: node:test passes TestContext, not a completion callback.
'use strict';
// Run with: node --test scripts/test-vault-positions.cjs
require('tsx/cjs');
process.env.NEXT_PUBLIC_MONARCH_API_NEW = 'https://monarch-test.invalid';
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '/test-image.png', width: 16, height: 16 };
  };
}
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  configurable: true,
});
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { WagmiProvider, createConfig, http } = require('wagmi');
const { mainnet } = require('viem/chains');
const { fetchUserVaultV2PositionReferences } = require('../src/data-sources/morpho-api/vaults');
const { fetchUserVaultV2DetailsAllNetworks } = require('../src/data-sources/monarch-api/vaults');
const { MORPHO_API_SUPPORTED_NETWORKS } = require('../src/config/dataSources');
const { useUserVaultsV2Query } = require('../src/hooks/queries/useUserVaultsV2Query');
const { useCustomRpc } = require('../src/stores/useCustomRpc');
const { fetchUserVaultShares, getVaultReadKey } = require('../src/utils/vaultAllocation');
const { getClient } = require('../src/utils/rpc');
const user = '0x0b2f3c85811018c8226033d209f8cfa0b0ae6868';
const address = '0x582cb3e2710e0975343ce8d749b46f614e94466b';
const vault = {
  id: `1_${address}`,
  vaultAddress: address,
  chainId: 1,
  asset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  name: 'Mt Pelerin USDC',
  symbol: 'MtP-USDC',
  owner: '0xf82978ea4c78705787fcdf20abf557b65dad0d63',
  curator: user,
  adapters: [],
  allocators: [],
  sentinels: [],
  caps: [],
};
const config = createConfig({ chains: [mainnet], transports: { 1: http() }, ssr: true });
function mockApi(t, handler) {
  t.mock.method(globalThis, 'fetch', async (_, request) => ({
    ok: true,
    json: async () => ({ data: await handler(JSON.parse(request.body)) }),
  }));
}
function queryFor(client, options) {
  function Hook() {
    useUserVaultsV2Query({ userAddress: user, includeApy: false, ...options });
    return null;
  }
  renderToString(
    React.createElement(WagmiProvider, { config }, React.createElement(QueryClientProvider, { client }, React.createElement(Hook))),
  );
  return client
    .getQueryCache()
    .findAll({ queryKey: ['user-vaults-v2'] })
    .at(-1);
}
function createClient(t) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  t.after(() => client.clear());
  return client;
}

test('Morpho discovery includes unlisted and transferred-in candidates, scoped to supported chains', async (t) => {
  const requests = [];
  mockApi(t, ({ query, variables }) => {
    requests.push(variables);
    assert.equal(variables.address, user);
    assert.ok(!query.includes('listed'));
    // No Deposit event or ownership relationship is required by this holder endpoint.
    return { userByAddress: { vaultV2Positions: variables.chainId === 1 || variables.chainId === 8453 ? [{ vault: { address } }] : [] } };
  });
  assert.deepEqual(await fetchUserVaultV2PositionReferences(user.toUpperCase()), [
    { address, chainId: 1 },
    { address, chainId: 8453 },
  ]);
  assert.deepEqual(
    requests.map((request) => request.chainId),
    MORPHO_API_SUPPORTED_NETWORKS,
  );
});

test('management discovery stays owner-only', async (t) => {
  mockApi(t, ({ query, variables }) => {
    assert.ok(query.includes('MonarchUserVaults'));
    assert.equal(variables.owner, user);
    assert.deepEqual(variables.positions, []);
    assert.deepEqual(variables.depositIds, []);
    return { Vault: [vault] };
  });
  assert.equal((await fetchUserVaultV2DetailsAllNetworks(user))[0].address, address);
});

test('deposit discovery uses receiver, pages by raw count, and retains deposits on chains outside Morpho', async (t) => {
  const deposited = { ...vault, chainId: 42793, id: `42793_${address}` };
  const offsets = [];
  mockApi(t, ({ query, variables }) => {
    if (query.includes('UserVaultDeposits')) {
      assert.ok(query.includes('onBehalf: { _eq: $user }'));
      assert.ok(!query.includes('isMonarch'));
      offsets.push(variables.offset);
      return {
        VaultV2_Deposit:
          variables.offset === 0
            ? Array.from({ length: 1000 }, (_, i) => ({ vault_id: `unsupported_${i}`, chainId: 31337 }))
            : [{ vault_id: deposited.id, chainId: 42793 }],
      };
    }
    assert.deepEqual(variables.depositIds, [deposited.id]);
    assert.deepEqual(variables.positions, [{ vaultAddress: { _eq: address }, chainId: { _eq: 1 } }]);
    return { Vault: [vault, deposited] };
  });
  const result = await fetchUserVaultV2DetailsAllNetworks(user, [{ address: address.toUpperCase(), chainId: 1 }]);
  assert.deepEqual(
    result.map((v) => v.networkId),
    [1, 42793],
  );
  assert.deepEqual(offsets, [0, 1000]);
});

test('missing discovery data or metadata rejects instead of returning an empty portfolio', async (t) => {
  mockApi(t, ({ query }) => (query.includes('UserVaultDeposits') ? { VaultV2_Deposit: [] } : { Vault: [] }));
  await assert.rejects(fetchUserVaultV2PositionReferences(user), /unavailable/);
  await assert.rejects(fetchUserVaultV2DetailsAllNetworks(user, [{ address, chainId: 1 }]), /details are unavailable/);
});

test('positions show non-owner holdings, confirm indexed candidates onchain, and preserve data on failed refresh', async (t) => {
  const exitedAddress = '0xce13e39534082fcf8f13f6d84e6d95414d14271e';
  mockApi(t, ({ query, variables }) => {
    if (query.includes('UserVaultV2Positions'))
      return {
        userByAddress: { vaultV2Positions: variables.chainId === 1 ? [{ vault: { address } }, { vault: { address: exitedAddress } }] : [] },
      };
    if (query.includes('UserVaultDeposits')) return { VaultV2_Deposit: [] };
    return { Vault: [vault, { ...vault, id: `1_${exitedAddress}`, vaultAddress: exitedAddress }] };
  });
  let fail = false;
  t.mock.method(getClient(1), 'multicall', async ({ contracts, allowFailure }) => {
    assert.equal(allowFailure, false);
    if (fail) throw new Error('RPC unavailable');
    if (contracts[0].functionName === 'balanceOf') {
      assert.deepEqual(contracts[0].args, [user]);
      return [5961491832005351266095n, 0n];
    }
    assert.equal(contracts.length, 1);
    assert.deepEqual(contracts[0].args, [5961491832005351266095n]);
    return [6028949143n];
  });
  const query = queryFor(createClient(t), { includePositions: true });
  const data = await query.fetch();
  assert.equal(data.length, 1);
  assert.equal(data[0].address, address);
  assert.notEqual(data[0].owner, user);
  assert.equal(data[0].balance, 6028949143n);
  fail = true;
  t.mock.method(console, 'error', () => {});
  await assert.rejects(query.fetch(), /RPC unavailable/);
  assert.equal(query.state.data, data);
  assert.equal(query.state.status, 'error');
});

test('redeem failures reject and a confirmed zero skips conversion', async (t) => {
  let shares = 0n;
  const calls = t.mock.method(getClient(1), 'multicall', async ({ contracts }) => {
    if (contracts[0].functionName === 'previewRedeem') throw new Error('redeem unavailable');
    return [shares];
  });
  const args = [[{ address, networkId: 1 }], user];
  assert.equal((await fetchUserVaultShares(...args)).get(getVaultReadKey(address, 1)), 0n);
  assert.equal(calls.mock.callCount(), 1);
  shares = 1n;
  await assert.rejects(fetchUserVaultShares(...args), /redeem unavailable/);
});

test('balance reads honor custom RPC and use chain-qualified keys', async (t) => {
  const { encodeFunctionResult, encodeAbiParameters, multicall3Abi } = require('viem');
  const customUrl = 'https://vault-test.invalid';
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, customUrl);
    return Response.json({
      jsonrpc: '2.0',
      id: 1,
      result: encodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        result: [{ success: true, returnData: encodeAbiParameters([{ type: 'uint256' }], [0n]) }],
      }),
    });
  });
  const balances = await fetchUserVaultShares([{ address, networkId: 8453 }], user, { 8453: customUrl });
  assert.equal(balances.get(getVaultReadKey(address, 8453)), 0n);
  assert.equal(balances.has(getVaultReadKey(address, 1)), false);
});

test('query cache separates owners, holdings, account, and custom RPC settings', (t) => {
  const client = createClient(t);
  queryFor(client, {});
  queryFor(client, { includePositions: true });
  queryFor(client, { includePositions: true, userAddress: user.toUpperCase() });
  assert.equal(client.getQueryCache().findAll().length, 2);
  queryFor(client, { includePositions: true, userAddress: address });
  const initialRpcSettings = useCustomRpc.getInitialState().customRpcUrls;
  initialRpcSettings[1] = 'https://vault-test.invalid';
  t.after(() => {
    initialRpcSettings[1] = undefined;
  });
  queryFor(client, { includePositions: true });
  assert.equal(client.getQueryCache().findAll().length, 4);
});
