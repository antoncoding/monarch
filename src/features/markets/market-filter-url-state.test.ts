import assert from 'node:assert/strict';
import test from 'node:test';
import type { Chain } from 'viem';
import { getMarketFilterAssetSelectionKey } from '@/features/markets/market-filter-selection';
import {
  parseMarketFilterTokenSelector,
  parseMarketFilterUrlState,
  resolveMarketFilterSelectionsFromUrlState,
  resolveSupportedNetworkPreference,
} from '@/features/markets/market-filter-url-state';
import { SupportedNetworks } from '@/utils/supported-networks';

const mainnet = { id: SupportedNetworks.Mainnet } as Chain;
const base = { id: SupportedNetworks.Base } as Chain;
const etherlink = { id: SupportedNetworks.Etherlink } as Chain;

const tokenItems = [
  {
    symbol: 'USDC',
    img: undefined,
    decimals: 6,
    networks: [
      { chain: mainnet, address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
      { chain: base, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
    ],
  },
  {
    symbol: 'XTZ',
    img: undefined,
    decimals: 18,
    networks: [{ chain: etherlink, address: '0xfc24f770F94edBca6D6f885E12d4317320BcB401' }],
  },
];

test('resolveSupportedNetworkPreference handles aliases, chain ids, and clear values', () => {
  assert.equal(resolveSupportedNetworkPreference('etherlink'), SupportedNetworks.Etherlink);
  assert.equal(resolveSupportedNetworkPreference('42793'), SupportedNetworks.Etherlink);
  assert.equal(resolveSupportedNetworkPreference('all'), null);
  assert.equal(resolveSupportedNetworkPreference('unknown-chain'), undefined);
});

test('parseMarketFilterTokenSelector supports canonical chain-address and symbol selectors', () => {
  assert.deepEqual(parseMarketFilterTokenSelector('8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'), {
    kind: 'chain-address',
    chainId: SupportedNetworks.Base,
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  });

  assert.deepEqual(parseMarketFilterTokenSelector('symbol:usdc'), {
    kind: 'symbol',
    symbol: 'usdc',
  });

  assert.deepEqual(parseMarketFilterTokenSelector('xtz'), {
    kind: 'symbol',
    symbol: 'xtz',
  });
});

test('parseMarketFilterUrlState prefers explicit network params and falls back to ref aliases', () => {
  const explicitUrlState = parseMarketFilterUrlState(
    new URLSearchParams([
      ['network', 'base'],
      ['ref', 'etherlink'],
      ['loan', '8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'],
      ['collateral', 'symbol:xtz'],
    ]),
  );

  assert.equal(explicitUrlState.selectedNetwork, SupportedNetworks.Base);
  assert.deepEqual(explicitUrlState.selectedLoanSelectors, [
    {
      kind: 'chain-address',
      chainId: SupportedNetworks.Base,
      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    },
  ]);
  assert.deepEqual(explicitUrlState.selectedCollateralSelectors, [
    {
      kind: 'symbol',
      symbol: 'xtz',
    },
  ]);
  assert.equal(explicitUrlState.signature, 'network:8453|loan:8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|collateral:symbol:xtz');

  const referralUrlState = parseMarketFilterUrlState(new URLSearchParams([['ref', 'etherlink']]));
  assert.equal(referralUrlState.selectedNetwork, SupportedNetworks.Etherlink);
  assert.equal(referralUrlState.signature, 'network:42793');
});

test('parseMarketFilterUrlState treats empty or clear token params as explicit resets', () => {
  const urlState = parseMarketFilterUrlState(
    new URLSearchParams([
      ['loan', 'all'],
      ['collateral', ''],
    ]),
  );

  assert.deepEqual(urlState.selectedLoanSelectors, []);
  assert.deepEqual(urlState.selectedCollateralSelectors, []);
  assert.equal(urlState.signature, 'loan:all|collateral:all');
});

test('resolveMarketFilterSelectionsFromUrlState maps selectors onto persisted asset keys', () => {
  const selections = resolveMarketFilterSelectionsFromUrlState(
    [
      {
        kind: 'chain-address',
        chainId: SupportedNetworks.Base,
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
      {
        kind: 'symbol',
        symbol: 'xtz',
      },
    ],
    tokenItems,
  );

  assert.deepEqual(selections, [getMarketFilterAssetSelectionKey(tokenItems[0]), getMarketFilterAssetSelectionKey(tokenItems[1])]);
});
