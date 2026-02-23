import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import type { Market, MarketPosition, TokenInfo } from '@/utils/types';

const marketId = '0xb8fc70e82bc5bb53e773626fcc6a23f7eefa036918d7ef216ecfb1950a94a85e';
const marketOracle = '0x1111111111111111111111111111111111111111';
const marketIrm = '0x2222222222222222222222222222222222222222';

const chainId = 1;
const chainName = 'ethereum';

const makeToken = ({
  id,
  address,
  symbol,
  name,
  decimals,
}: {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}): TokenInfo => ({
  id,
  address,
  symbol,
  name,
  decimals,
});

export const createUiLabMarketFixture = (): Market => ({
  id: marketId,
  lltv: '860000000000000000',
  uniqueKey: marketId,
  irmAddress: marketIrm,
  oracleAddress: marketOracle,
  whitelisted: true,
  morphoBlue: {
    id: 'morpho-blue-mainnet',
    address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    chain: {
      id: chainId,
    },
  },
  loanAsset: makeToken({
    id: `${chainName}-usdc`,
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  }),
  collateralAsset: makeToken({
    id: `${chainName}-weth`,
    address: '0xC02aaA39b223FE8D0A0E5C4F27EAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  }),
  state: {
    borrowAssets: '74250000000',
    supplyAssets: '125000000000',
    borrowAssetsUsd: 74250,
    supplyAssetsUsd: 125000,
    borrowShares: '74220000000',
    supplyShares: '124940000000',
    liquidityAssets: '50750000000',
    liquidityAssetsUsd: 50750,
    collateralAssets: '160000000000000000000',
    collateralAssetsUsd: 520000,
    utilization: 0.594,
    supplyApy: 0.048,
    borrowApy: 0.076,
    fee: 0,
    timestamp: 1735689600,
    apyAtTarget: 0.06,
    rateAtTarget: '60000000000000000',
    dailySupplyApy: 0.047,
    dailyBorrowApy: 0.074,
    weeklySupplyApy: 0.048,
    weeklyBorrowApy: 0.076,
    monthlySupplyApy: 0.05,
    monthlyBorrowApy: 0.078,
  },
  realizedBadDebt: {
    underlying: '0',
  },
  supplyingVaults: [],
  hasUSDPrice: true,
  warnings: [],
});

export const createUiLabBorrowPositionFixture = (market: Market): MarketPosition => ({
  market,
  state: {
    supplyShares: '0',
    supplyAssets: '0',
    borrowShares: '59940000000',
    borrowAssets: '60000000000',
    collateral: '82000000000000000000',
  },
});

export const createUiLabSupplyPositionFixture = (market: Market): MarketPosition => ({
  market,
  state: {
    supplyShares: '27480000000',
    supplyAssets: '27500000000',
    borrowShares: '0',
    borrowAssets: '0',
    collateral: '0',
  },
});

export const uiLabLiquiditySourcingFixture: LiquiditySourcingResult = {
  totalAvailableExtraLiquidity: 0n,
  canSourceLiquidity: false,
  isLoading: false,
  computeReallocation: () => null,
  refetch: () => {},
};

// Morpho oracle price normalized to 1e36 with 18(collateral)-vs-6(loan) decimals accounted for.
export const uiLabOraclePrice = 3250n * 10n ** 24n;
