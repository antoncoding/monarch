import { mainnet } from 'viem/chains';
import type { Address } from 'viem';
import { infoToKey, supportedTokens, type ERC20Token, type UnknownERC20Token } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { createUiLabMarketFixture } from '@/features/ui-lab/fixtures/market-fixtures';

type AssetFilterItem = ERC20Token | UnknownERC20Token;

const uiLabPreferredAssetSymbols = ['USDC', 'USDT', 'WETH', 'WBTC', 'cbBTC', 'PYUSD'] as const;

const hasMainnetAddress = (token: AssetFilterItem): boolean => {
  return token.networks.some((network) => network.chain.id === mainnet.id);
};

const buildAssetSelectionKey = (token: AssetFilterItem): string => {
  return token.networks.map((network) => infoToKey(network.address, network.chain.id)).join('|');
};

export const createUiLabAssetFilterItems = (): AssetFilterItem[] => {
  const symbolSet = new Set<string>(uiLabPreferredAssetSymbols);
  return supportedTokens
    .filter((token) => symbolSet.has(token.symbol) && hasMainnetAddress(token))
    .slice(0, uiLabPreferredAssetSymbols.length);
};

export const createUiLabDefaultAssetSelection = (items: AssetFilterItem[]): string[] => {
  return items.slice(0, 2).map(buildAssetSelectionKey);
};

export const createUiLabMarketVariantsFixture = (): Market[] => {
  const baseMarket = createUiLabMarketFixture();

  const stablecoinBorrowMarket: Market = {
    ...baseMarket,
    id: '0x5f8a138ba332398a9116910f4d5e5dcd9b207024c5290ce5bc87bc2dbd8e4a86',
    uniqueKey: '0x5f8a138ba332398a9116910f4d5e5dcd9b207024c5290ce5bc87bc2dbd8e4a86',
    oracleAddress: '0x3333333333333333333333333333333333333333',
    irmAddress: '0x4444444444444444444444444444444444444444',
    loanAsset: {
      ...baseMarket.loanAsset,
      id: 'ethereum-usdt',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    collateralAsset: {
      ...baseMarket.collateralAsset,
      id: 'ethereum-wbtc',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
    },
    state: {
      ...baseMarket.state,
      borrowAssets: '48100000000',
      supplyAssets: '93200000000',
      borrowAssetsUsd: 48100,
      supplyAssetsUsd: 93200,
      liquidityAssets: '45100000000',
      liquidityAssetsUsd: 45100,
      collateralAssets: '4850000000',
      collateralAssetsUsd: 297000,
      utilization: 0.516,
      supplyApy: 0.041,
      borrowApy: 0.066,
      apyAtTarget: 0.053,
      rateAtTarget: '53000000000000000',
      dailySupplyApy: 0.04,
      dailyBorrowApy: 0.065,
      weeklySupplyApy: 0.041,
      weeklyBorrowApy: 0.066,
      monthlySupplyApy: 0.042,
      monthlyBorrowApy: 0.067,
    },
  };

  const bitcoinBorrowMarket: Market = {
    ...baseMarket,
    id: '0x37e7484d642d90f14451f1910ba4b7b8e4c3ccdd0ec28f8b2bdb35479e472ba7',
    uniqueKey: '0x37e7484d642d90f14451f1910ba4b7b8e4c3ccdd0ec28f8b2bdb35479e472ba7',
    oracleAddress: '0x5555555555555555555555555555555555555555',
    irmAddress: '0x6666666666666666666666666666666666666666',
    loanAsset: {
      ...baseMarket.loanAsset,
      id: 'ethereum-wbtc',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
    },
    collateralAsset: {
      ...baseMarket.collateralAsset,
      id: 'ethereum-weth',
      address: '0xC02aaA39b223FE8D0A0E5C4F27EAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    state: {
      ...baseMarket.state,
      borrowAssets: '129000000',
      supplyAssets: '244000000',
      borrowAssetsUsd: 112000000,
      supplyAssetsUsd: 212000000,
      liquidityAssets: '115000000',
      liquidityAssetsUsd: 100000000,
      collateralAssets: '90400000000000000000',
      collateralAssetsUsd: 292000,
      utilization: 0.528,
      supplyApy: 0.019,
      borrowApy: 0.033,
      apyAtTarget: 0.027,
      rateAtTarget: '27000000000000000',
      dailySupplyApy: 0.019,
      dailyBorrowApy: 0.032,
      weeklySupplyApy: 0.019,
      weeklyBorrowApy: 0.033,
      monthlySupplyApy: 0.02,
      monthlyBorrowApy: 0.034,
    },
  };

  return [baseMarket, stablecoinBorrowMarket, bitcoinBorrowMarket];
};

export const uiLabAccountAddressFixtures: Address[] = [
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  '0x66f820a414680B5bcda5eECA5dea238543F42054',
];

export const uiLabTransactionHashFixtures = [
  '0xc18316f6405f6d22be8924bf2085b4b42f6df8947fb4e9f8c92312e5a85f8d48',
  '0x8ce8f8fb0f83db4f1db1e5914f4f67f216178e8ce4fce1092f1b180dbc8933d1',
] as const;

export const uiLabCollateralFixtures = [
  {
    address: '0xC02aaA39b223FE8D0A0E5C4F27EAD9083C756Cc2',
    symbol: 'WETH',
    amount: 5.24,
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    amount: 1.18,
  },
  {
    address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    amount: 18540,
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    amount: 9400,
  },
  {
    address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    symbol: 'LDO',
    amount: 620,
  },
  {
    address: '0x7f39c581f595b53c5cb5bbcf7f95e66b3d5f6d18',
    symbol: 'wstETH',
    amount: 3.72,
  },
];
