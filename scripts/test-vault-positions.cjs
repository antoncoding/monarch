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
const { fetchUserVaultV2PositionReferences, fetchMorphoVaultV2Metadata } = require('../src/data-sources/morpho-api/vaults');
const { fetchUserVaultV2DetailsAllNetworks } = require('../src/data-sources/monarch-api/vaults');
const { MORPHO_API_SUPPORTED_NETWORKS } = require('../src/config/dataSources');
const { useUserVaultsV2Query } = require('../src/hooks/queries/useUserVaultsV2Query');
const { useMorphoVaultV2MetadataQuery } = require('../src/hooks/queries/useMorphoVaultV2MetadataQuery');
const { calculateAssetBreakdown, groupAssetBreakdown } = require('../src/utils/portfolio');
const { supportedTokens } = require('../src/utils/tokens');
const { getTokenPriceKey } = require('../src/data-sources/morpho-api/prices');
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

test('missing users on other chains do not discard a held vault', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, request) => {
    const { variables } = JSON.parse(request.body);
    if (variables.chainId === 1) return Response.json({ data: { userByAddress: { vaultV2Positions: [{ vault: { address } }] } } });
    if (variables.chainId === 8453) return Response.json({ data: { userByAddress: null } });
    return Response.json({ data: null, errors: [{ status: 'NOT_FOUND', message: 'User not found' }] });
  });
  assert.deepEqual(await fetchUserVaultV2PositionReferences(user), [{ address, chainId: 1 }]);
});

test('all users absent resolves successfully with no holdings', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: null, errors: [{ status: 'NOT_FOUND' }] }));
  assert.deepEqual(await fetchUserVaultV2PositionReferences(user), []);
});

test('a present user with a missing, null, or malformed positions field remains an error', async (t) => {
  let payload = {};
  mockApi(t, () => ({ userByAddress: payload }));
  for (const malformed of [{}, { vaultV2Positions: null }, { vaultV2Positions: {} }]) {
    payload = malformed;
    await assert.rejects(fetchUserVaultV2PositionReferences(user), /unavailable/);
  }
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
  // SSR normally reads the boot snapshot. Use the browser snapshot here to test
  // live store actions without changing initial state or cached key objects.
  t.mock.method(React, 'useSyncExternalStore', (_, getSnapshot) => getSnapshot());
  const client = createClient(t);
  queryFor(client, {});
  const originalQuery = queryFor(client, { includePositions: true });
  const originalHash = originalQuery.queryHash;
  queryFor(client, { includePositions: true, userAddress: user.toUpperCase() });
  assert.equal(client.getQueryCache().findAll().length, 2);
  queryFor(client, { includePositions: true, userAddress: address });
  const previousRpcSettings = useCustomRpc.getState().customRpcUrls;
  useCustomRpc.getState().setRpcUrl(1, 'https://vault-test.invalid');
  t.after(() => {
    useCustomRpc.getState().resetRpcUrl(1);
  });
  queryFor(client, { includePositions: true });
  assert.equal(client.getQueryCache().findAll().length, 4);
  assert.equal(previousRpcSettings[1], undefined);
  assert.deepEqual(originalQuery.queryKey.at(-1), {});
  assert.equal(originalQuery.queryHash, originalHash);
  assert.notEqual(useCustomRpc.getState().customRpcUrls, previousRpcSettings);
});

const apiMetadata = {
  address,
  chain: { id: 1 },
  asset: { address: vault.asset, symbol: 'USDC' },
  name: vault.name,
  symbol: vault.symbol,
  listed: false,
  metadata: null,
  curator: { address: user },
  curators: {
    items: [
      { name: 'Other chain', image: 'https://cdn.morpho.org/other.svg', addresses: [{ address: user, chainId: 8453 }] },
      { name: 'Curator', image: 'https://cdn.morpho.org/curator.svg', addresses: [{ address: user.toUpperCase(), chainId: 1 }] },
    ],
  },
};

test('curator branding matches both address and chain, preserves unlisted vaults, and skips absent brands', async (t) => {
  mockApi(t, ({ query, variables }) => {
    assert.ok(query.includes('curators(first: 10)'));
    assert.deepEqual(variables.where.chainId_in, [1, 8453]);
    assert.equal(variables.where.listed, undefined);
    return {
      vaultV2s: {
        items: [
          null,
          apiMetadata,
          { ...apiMetadata, chain: { id: 8453 }, curators: { items: null } },
          { ...apiMetadata, chain: { id: 137 } },
        ],
      },
    };
  });
  const metadata = await fetchMorphoVaultV2Metadata([
    { address: address.toUpperCase(), networkId: 1 },
    { address, chainId: 8453 },
    { address, chainId: 31337 },
  ]);
  assert.equal(metadata.length, 2);
  assert.deepEqual(metadata[0].curator, { name: 'Curator', image: 'https://cdn.morpho.org/curator.svg' });
  assert.equal(metadata[0].listed, false);
  assert.equal(metadata[1].curator, undefined);
});

test('vault metadata distinguishes confirmed absence from unavailable data through the shared fetcher', async (t) => {
  let payload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  for (const absent of [{ data: { vaultV2s: { items: [] } } }, { data: null, errors: [{ status: 'NOT_FOUND' }] }]) {
    payload = absent;
    assert.deepEqual(await fetchMorphoVaultV2Metadata([{ address, chainId: 1 }]), []);
  }
  for (const unavailable of [
    { data: {} },
    { data: { vaultV2s: null } },
    { data: { vaultV2s: { items: null } } },
    { data: { vaultV2s: { items: {} } } },
    { data: null, errors: [{ status: 'NOT_FOUND' }, { message: 'Rate limited' }] },
  ]) {
    payload = unavailable;
    await assert.rejects(fetchMorphoVaultV2Metadata([{ address, chainId: 1 }]));
  }
  payload = { data: { vaultV2s: { items: [apiMetadata] } }, errors: [{ status: 'NOT_FOUND' }] };
  assert.equal((await fetchMorphoVaultV2Metadata([{ address, chainId: 1 }])).length, 1);
});

test('curator metadata refresh errors retain the last successful logos', async (t) => {
  const client = createClient(t);
  function MetadataHook() {
    useMorphoVaultV2MetadataQuery({ vaults: [{ address, networkId: 1 }] });
    return null;
  }
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(MetadataHook)));
  let fail = false;
  t.mock.method(globalThis, 'fetch', async () => {
    if (fail) throw new Error('Offline');
    return Response.json({ data: { vaultV2s: { items: [apiMetadata] } } });
  });
  const query = client.getQueryCache().find({ queryKey: ['morpho-vault-v2-metadata'], exact: false });
  const data = await query.fetch();
  fail = true;
  await assert.rejects(query.fetch(), /Offline/);
  assert.equal(query.state.data, data);
  assert.equal(query.state.status, 'error');
});

const findToken = (tokenAddress, chainId) =>
  supportedTokens.find((token) =>
    token.networks.some((network) => network.chain.id === chainId && network.address.toLowerCase() === tokenAddress.toLowerCase()),
  );

test('asset summaries combine market and vault USDC across networks using each network price', () => {
  const baseUsdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  const positions = [
    {
      state: { supplyAssets: '10000000' },
      market: { loanAsset: { address: vault.asset, symbol: 'USDC', decimals: 6 }, morphoBlue: { chain: { id: 1 } } },
    },
  ];
  const prices = new Map([
    [getTokenPriceKey(vault.asset, 1), 0.99],
    [getTokenPriceKey(baseUsdc, 8453), 1.01],
  ]);
  const items = calculateAssetBreakdown(positions, [{ asset: baseUsdc, networkId: 8453, balance: 20000000n }], prices, findToken);
  const before = structuredClone(items);
  const summary = groupAssetBreakdown(items, findToken);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].balance, 30);
  assert.ok(Math.abs(summary[0].usdValue - 30.1) < 0.000001);
  assert.equal(summary[0].supplyMarketCount, 1);
  assert.equal(summary[0].vaultCount, 1);
  assert.deepEqual(items, before);
});

test('asset summaries do not merge unrelated tokens just because their tickers match', () => {
  const item = {
    tokenAddress: vault.asset,
    chainId: 1,
    symbol: 'USDC',
    balance: 10,
    price: 1,
    usdValue: 10,
    supplyMarketCount: 1,
    vaultCount: 0,
    borrowMarketCount: 0,
  };
  const summary = groupAssetBreakdown([item, { ...item, tokenAddress: address, chainId: 8453 }], findToken);
  assert.equal(summary.length, 2);
  assert.equal(
    summary.reduce((total, asset) => total + asset.usdValue, 0),
    20,
  );
  assert.deepEqual(groupAssetBreakdown([], findToken), []);
});
