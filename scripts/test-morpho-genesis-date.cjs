'use strict';
// Run with: node --test scripts/test-morpho-genesis-date.cjs
require('tsx/cjs');
for (const extension of ['.png', '.svg', '.webp', '.jpg']) {
  require.extensions[extension] = (module) => {
    // biome-ignore lint/suspicious/noExportsInTest: Image stub for transitive Next.js imports.
    module.exports = { src: '/test-image.png', width: 16, height: 16 };
  };
}
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getMorphoGenesisDate } = require('../src/utils/morpho');
const { ALL_SUPPORTED_NETWORKS, SupportedNetworks } = require('../src/utils/supported-networks');

// Timestamps of the blocks that deployed Morpho on each chain
// (deployment blocks from @morpho-org/morpho-ts `deployments`, timestamps read from each chain's RPC).
const DEPLOYMENT_BLOCK_TIMES = {
  [SupportedNetworks.Mainnet]: '2023-12-28T09:09:23.000Z', // block 18883124
  [SupportedNetworks.Base]: '2024-05-03T13:40:43.000Z', // block 13977148
  [SupportedNetworks.Polygon]: '2025-01-20T14:03:12.000Z', // block 66931042
  [SupportedNetworks.Unichain]: '2025-02-18T14:03:06.000Z', // block 9139027
  [SupportedNetworks.Arbitrum]: '2025-01-17T18:04:51.000Z', // block 296446593
  [SupportedNetworks.HyperEVM]: '2025-04-03T16:52:00.000Z', // block 1988429
  [SupportedNetworks.Robinhood]: '2026-05-11T08:55:04.000Z', // block 286
};

test('every supported network has a valid genesis date', () => {
  for (const chainId of ALL_SUPPORTED_NETWORKS) {
    const date = getMorphoGenesisDate(chainId);
    assert.ok(Number.isFinite(date.getTime()), `chain ${chainId} genesis date is Invalid Date`);
  }
});

test('genesis dates match the Morpho deployment block timestamps', () => {
  for (const [chainId, iso] of Object.entries(DEPLOYMENT_BLOCK_TIMES)) {
    assert.equal(getMorphoGenesisDate(Number(chainId)).toISOString(), iso, `chain ${chainId}`);
  }
});
