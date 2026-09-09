'use strict';
// Run with: node --test scripts/test-custom-oracle-feeds.cjs
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '/test-image.png', width: 16, height: 16 };
  };
}
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getOracleFeedData } = require('../src/hooks/useOracleMetadata');
const { getFeedMetadataSnapshot } = require('../src/hooks/useFeedLastUpdatedByChain');
const { createUnknownOracleFilter, createOracleFilter } = require('../src/utils/marketFilters');
const { getOracleVendorInfo, getOracleType, OracleType, PriceFeedVendors } = require('../src/utils/oracle');
const { getFeedOccurrencesForOracle, findFeedOccurrences } = require('../src/features/feed-detail/feed-detail-utils');
const { getMarketWarningsWithDetail } = require('../src/utils/warnings');

const address = '0x3b789d4316ab5019fe57bbf3b80a0b656430b75d';
const uranium = {
  address: '0xb81131b6368b3f0a83af09db4e39ac23da96c2db',
  description: 'Uranium / USD per pound',
  provider: 'Redstone',
  pair: ['URANIUM (lb)', 'USD'],
};
const usdc = { address: '0x4f9a119fbe04f89a0491f7c983b9363ed42b187b', description: 'USDC / USD', provider: 'Pyth', pair: ['USDC', 'USD'] };
const oracle = {
  address,
  chainId: 42793,
  type: 'custom',
  data: {
    adapterId: 'etherlink-xu3o8-ounce-wrapper',
    adapterName: 'xU3o8 Uranium Ounce Oracle',
    feeds: { baseFeedOne: uranium, quoteFeedOne: usdc, baseFeedTwo: null, quoteFeedTwo: null, baseVault: null, quoteVault: null },
    metadata: {
      tier: 'monarch_verified',
      vendor: 'Tezos',
      underlyingOracle: '0x0b1d9871d5579b5588438e5023495a38c7741537',
      priceDivisor: '16',
    },
  },
};
const record = (entry = oracle) => ({ [`42793-${address}`]: entry });
const market = { oracleAddress: address.toUpperCase(), morphoBlue: { chain: { id: 42793 } } };

test('custom inputs retain both feed vendors independently of wrapper ownership and approval', () => {
  const info = getOracleVendorInfo(address.toUpperCase(), 42793, record());
  assert.deepEqual(info.coreVendors, [PriceFeedVendors.Redstone, PriceFeedVendors.PythNetwork]);
  assert.equal(info.isMonarchVerifiedOracle, true);
  assert.equal(info.hasMonarchVerified, true);
  assert.equal(info.hasUnknown, false);
  assert.equal(info.coreVendors.includes('Tezos'), false);
  assert.equal(getOracleType(address, 42793, record()), OracleType.Custom);
  assert.deepEqual(getOracleFeedData(oracle), oracle.data.feeds);
  assert.equal(createUnknownOracleFilter(false, record())(market), true);
});

test('wrapper approval never hides an unknown input vendor', () => {
  const unknown = {
    ...oracle,
    data: { ...oracle.data, feeds: { ...oracle.data.feeds, baseFeedOne: { ...uranium, provider: null, pair: [] } } },
  };
  const info = getOracleVendorInfo(address, 42793, record(unknown));
  assert.deepEqual(info.coreVendors, [PriceFeedVendors.PythNetwork]);
  assert.equal(info.hasUnknown, true);
  assert.equal(info.isMonarchVerifiedOracle, true);
  assert.equal(createUnknownOracleFilter(false, record(unknown))(market), false);
});

test('verified input feeds cannot approve an unlisted wrapper', () => {
  const unlisted = {
    ...oracle,
    data: { ...oracle.data, metadata: {}, feeds: { baseFeedOne: { ...uranium, provider: 'MonarchVerified', tier: 'monarch_verified' } } },
  };
  const info = getOracleVendorInfo(address, 42793, record(unlisted));
  assert.equal(info.hasMonarchVerified, true);
  assert.equal(info.isMonarchVerifiedOracle, false);
  assert.equal(createUnknownOracleFilter(false, record(unlisted))(market), false);
});

test('missing custom dependency metadata remains unknown; disabling the guard still works', () => {
  const missing = { ...oracle, data: { ...oracle.data, feeds: undefined } };
  assert.equal(createUnknownOracleFilter(false, record(missing))(market), false);
  assert.equal(createUnknownOracleFilter(true, record(missing))(market), true);
  assert.equal(createUnknownOracleFilter(false, {})(market), true);
});

test('vendor filters include both custom oracle dependencies', () => {
  assert.equal(createOracleFilter([PriceFeedVendors.Redstone], record())(market), true);
  assert.equal(createOracleFilter([PriceFeedVendors.PythNetwork], record())(market), true);
  assert.equal(createOracleFilter([PriceFeedVendors.Chainlink], record())(market), false);
});

test('warnings distinguish an approved wrapper from unknown dependencies and unlisted wrappers', () => {
  const warningMarket = { ...market, uniqueKey: 'custom-oracle-test', state: {}, warnings: [] };
  const warningCodes = (entry) =>
    getMarketWarningsWithDetail(warningMarket, { oracleMetadataMap: record(entry) }).map((warning) => warning.code);
  assert.deepEqual(warningCodes(oracle), []);
  const unknownInput = { ...oracle, data: { ...oracle.data, feeds: { baseFeedOne: { ...uranium, provider: null } } } };
  assert.deepEqual(warningCodes(unknownInput), ['unknown feeds']);
  const unlisted = { ...oracle, data: { ...oracle.data, metadata: {} } };
  assert.deepEqual(warningCodes(unlisted), ['unrecognized_oracle']);
});

test('feed refresh and existing feed pages include custom input dependencies', () => {
  const snapshot = getFeedMetadataSnapshot(record());
  assert.deepEqual(snapshot.addresses, [uranium.address, usdc.address].sort());
  const occurrences = getFeedOccurrencesForOracle(oracle, uranium.address.toUpperCase());
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].source, 'custom');
  assert.equal(occurrences[0].role, 'baseFeedOne');
  assert.equal(occurrences[0].leg.provider, 'Redstone');
  assert.equal(findFeedOccurrences(record(), uranium.address, 1).length, 0);
  assert.deepEqual(getOracleVendorInfo(address, 1, { [address]: oracle }).coreVendors, []);
});

test('standard and meta feeds keep their dependency and vendor behavior', () => {
  const standard = { ...oracle, type: 'standard', data: oracle.data.feeds };
  const meta = {
    ...oracle,
    type: 'meta',
    data: { primaryOracle: address, currentOracle: address, backupOracle: '', oracleSources: { primary: oracle.data.feeds, backup: null } },
  };
  for (const entry of [standard, meta]) {
    assert.deepEqual(getOracleVendorInfo(address, 42793, record(entry)).coreVendors, [
      PriceFeedVendors.Redstone,
      PriceFeedVendors.PythNetwork,
    ]);
    assert.equal(createUnknownOracleFilter(false, record(entry))(market), true);
    assert.equal(getFeedOccurrencesForOracle(entry, usdc.address).length, 1);
  }
});

test('oracle breakdown attributes exposure to input vendors, while custom price-path decoding stays separate', () => {
  const { buildRiskAnalysis } = require('../src/features/analysis/utils/oracle-risk-analysis');
  const populatedMarket = {
    ...market,
    uniqueKey: '0x1480207aed3544fed0c3128316cf9ed9776d3a2ce2243536827a2d660ab929bf',
    loanAsset: { address: '0x796ea11fa2dd751ed01b53c372ffdb4aaa8f00f9', symbol: 'USDC' },
    collateralAsset: { address: '0x79052ab3c166d4899a1e0dd033ac3b379af0b1fd', symbol: 'xU3o8' },
    state: { supplyAssetsUsd: 100, borrowAssetsUsd: 40, collateralAssetsUsd: 120 },
  };
  const result = buildRiskAnalysis({ markets: [populatedMarket], oracleMetadataMap: record(), exposureMetric: 'supply' });
  assert.deepEqual(result.oracleBuckets.map((bucket) => bucket.label).sort(), ['Pyth Network', 'Redstone']);
  assert.deepEqual(
    result.oracleBuckets.map((bucket) => bucket.valueUsd),
    [50, 50],
  );
  assert.equal(result.unknownOracleCount, 0);
  assert.equal(result.rows[0].oracleType, 'custom');
  assert.equal(result.rows[0].isValidPath, false);
  assert.equal(result.rows[0].unknownLegCount, 0);
});

test('existing table and market-page caller props render custom dependencies without opting into generic custom text', () => {
  const Module = require('node:module');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const metadata = require('../src/hooks/useOracleMetadata');
  const originalLoad = Module._load;
  const originalReact = global.React;
  let currentOracle = oracle;
  let snapshots = {};
  let snapshotPending = false;
  let directReadOptions = [];
  let snapshotChains = [];
  // Match the existing JSX-preserve test runtime; the app compiler supplies the JSX runtime.
  global.React = React;
  Module._load = function loadWithMockedHooks(request, parent, isMain) {
    if (request === '@/hooks/useOracleMetadata') {
      return { ...metadata, useOracleMetadata: () => ({ data: record(currentOracle), isLoading: false }) };
    }
    if (request === '@/hooks/useFeedLastUpdatedByChain') {
      return {
        useFeedLastUpdatedByChain: (chainId) => {
          snapshotChains.push(chainId);
          return { data: snapshots, isLoading: snapshotPending };
        },
      };
    }
    if (request === '@/hooks/queries/useKlerosAddressTagsQuery') return { useKlerosAddressTagsQuery: () => ({ data: {} }) };
    if (request === 'wagmi') {
      return {
        ...originalLoad.call(this, request, parent, isMain),
        useReadContracts: (options) => {
          directReadOptions.push(options);
          return { data: undefined };
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { TooltipProvider } = require('../src/components/ui/tooltip');
    const { OracleTypeInfo } = require('../src/features/markets/components/oracle/MarketOracle/OracleTypeInfo');
    const render = (props) =>
      renderToStaticMarkup(
        React.createElement(
          TooltipProvider,
          null,
          React.createElement(OracleTypeInfo, { oracleAddress: address, chainId: 42793, ...props }),
        ),
      );
    for (const props of [{}, { useBadge: true, variant: 'detail' }]) {
      const markup = render(props);
      assert.ok(markup.includes(`/feed/42793/${uranium.address}`));
      assert.ok(markup.includes(`/feed/42793/${usdc.address}`));
      assert.ok(markup.includes(oracle.data.metadata.underlyingOracle));
      assert.ok(markup.includes('Underlying price ÷ 16'));
    }
    // These are actual FeedEntry query options, including the initial batch-loading state.
    for (const type of ['custom', 'standard', 'meta']) {
      currentOracle =
        type === 'custom'
          ? oracle
          : type === 'standard'
            ? { ...oracle, type, data: oracle.data.feeds }
            : { ...oracle, type, data: { primaryOracle: address, currentOracle: address, oracleSources: { primary: oracle.data.feeds } } };
      for (const phase of ['pending', 'ready', 'missing-price', 'missing-time', 'failed']) {
        snapshotPending = phase === 'pending';
        snapshots =
          phase === 'ready' || phase.startsWith('missing-')
            ? Object.fromEntries(
                [uranium.address, usdc.address].map((key) => [
                  key,
                  {
                    normalizedPrice: phase === 'missing-price' ? null : '1',
                    updatedAt: phase === 'missing-time' ? null : 123,
                    updateKind: 'reported',
                  },
                ]),
              )
            : {};
        directReadOptions = [];
        render({});
        assert.equal(directReadOptions.length, 2);
        const shouldFallback = phase === 'failed' || phase.startsWith('missing-');
        assert.ok(directReadOptions.every((options) => options.query.enabled === shouldFallback));
        assert.ok(directReadOptions.every((options) => options.query.refetchIntervalInBackground === false));
      }
    }
    currentOracle = { ...oracle, data: { ...oracle.data, feeds: { baseFeedOne: { ...uranium, feedType: 'constant' } } } };
    directReadOptions = [];
    render({});
    assert.equal(directReadOptions[0].query.enabled, false);
    currentOracle = { ...oracle, data: { ...oracle.data, feeds: undefined } };
    snapshotChains = [];
    assert.ok(render({}).includes('Feed dependencies unavailable'));
    assert.deepEqual(snapshotChains, [undefined]);
  } finally {
    Module._load = originalLoad;
    global.React = originalReact;
  }
});

test('shared feed loading includes metadata hydration and remains idle without a chain', () => {
  const Module = require('node:module');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const metadata = require('../src/hooks/useOracleMetadata');
  const hookPath = require.resolve('../src/hooks/useFeedLastUpdatedByChain');
  const cachedHook = require.cache[hookPath];
  const originalLoad = Module._load;
  let metadataLoading = true;
  let metadataRecord = {};
  let result;
  const client = new QueryClient();
  delete require.cache[hookPath];
  Module._load = function loadFeedQuery(request, parent, isMain) {
    if (request === '@/hooks/useOracleMetadata') {
      return { ...metadata, useOracleMetadata: () => ({ data: metadataRecord, isLoading: metadataLoading }) };
    }
    if (request === 'wagmi') return { ...originalLoad.call(this, request, parent, isMain), usePublicClient: () => ({}) };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { useFeedLastUpdatedByChain } = require(hookPath);
    const Probe = ({ chainId }) => {
      result = useFeedLastUpdatedByChain(chainId);
      return null;
    };
    const render = (chainId) =>
      renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe, { chainId })));
    render(42793);
    assert.equal(result.isLoading, true);
    render(undefined);
    assert.equal(result.isLoading, false);
    metadataLoading = false;
    metadataRecord = record();
    render(42793);
    assert.equal(result.isLoading, true);
  } finally {
    Module._load = originalLoad;
    require.cache[hookPath] = cachedHook;
    client.clear();
  }
});
