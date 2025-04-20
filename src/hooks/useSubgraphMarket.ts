import { useQuery } from '@tanstack/react-query';
import { SupportedNetworks } from '@/utils/networks';
import { getSubgraphUrl } from '@/utils/subgraph-urls';
import { WarningWithDetail, MorphoChainlinkOracleData, Market } from '../utils/types';
import {
  marketQuery as subgraphMarketQuery
} from '../graphql/morpho-subgraph-queries';
import {
  SubgraphMarket,
  SubgraphMarketQueryResponse,
  SubgraphToken,
} from '../utils/subgraph-types';
import { Address } from 'viem';

const subgraphGraphqlFetcher = async <T extends object>(
  apiUrl: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const result = (await response.json()) as T;

  if ('errors' in result && Array.isArray((result as any).errors) && (result as any).errors.length > 0) {
    throw new Error((result as any).errors[0].message);
  }

  return result;
};

// Helper to safely parse BigDecimal/BigInt strings
const safeParseFloat = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  try {
    return parseFloat(value);
  } catch {
    return 0;
  }
};

const safeParseInt = (value: string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    try {
        return parseInt(value, 10);
    } catch {
        return 0;
    }
}

const transformSubgraphMarketToMarketDetail = (subgraphMarket: Partial<SubgraphMarket>, network: SupportedNetworks): Market => {

  const marketId = subgraphMarket.id ?? '';
  const lltv = subgraphMarket.lltv ?? '0';
  const irmAddress = subgraphMarket.irm ?? '0x';
  const inputTokenPriceUSD = subgraphMarket.inputTokenPriceUSD ?? '0';
  const totalDepositBalanceUSD = subgraphMarket.totalDepositBalanceUSD ?? '0';
  const totalBorrowBalanceUSD = subgraphMarket.totalBorrowBalanceUSD ?? '0';
  const totalSupplyShares = subgraphMarket.totalSupplyShares ?? '0';
  const totalBorrowShares = subgraphMarket.totalBorrowShares ?? '0';
  const fee = subgraphMarket.fee ?? '0';

  console.log('subgraphMarket', subgraphMarket);

  const mapToken = (token: Partial<SubgraphToken> | undefined) => ({
    id: token?.id ?? '0x',
    address: token?.id ?? '0x',
    symbol: token?.symbol ?? 'Unknown',
    name: token?.name ?? 'Unknown Token',
    decimals: token?.decimals ?? 18,
  });

  const loanAsset = mapToken(subgraphMarket.borrowedToken);
  const collateralAsset = mapToken(subgraphMarket.inputToken);

  const defaultOracleData: MorphoChainlinkOracleData = {
    baseFeedOne: null,
    baseFeedTwo: null,
    quoteFeedOne: null,
    quoteFeedTwo: null,
  };

  // TODO: Implement mapping from subgraphMarket.protocol?.network string to chain ID number
  const chainId = network;

  const borrowAssets = subgraphMarket.totalBorrow ?? '0';
  const supplyAssets = subgraphMarket.totalSupply ?? '0';
  const collateralAssets = subgraphMarket.inputTokenBalance ?? '0';
  const collateralAssetsUsd = safeParseFloat(subgraphMarket.totalValueLockedUSD);
  const timestamp = safeParseInt(subgraphMarket.lastUpdate);

  const totalSupplyNum = safeParseFloat(supplyAssets);
  const totalBorrowNum = safeParseFloat(borrowAssets);
  const utilization = totalSupplyNum > 0 ? (totalBorrowNum / totalSupplyNum) * 100 : 0;

  const supplyApy = Number(subgraphMarket.rates?.find(r => r.side === 'LENDER')?.rate ?? 0);
  const borrowApy = Number(subgraphMarket.rates?.find(r => r.side === 'BORROWER')?.rate ?? 0);

  const liquidityAssets = (BigInt(supplyAssets) - BigInt(borrowAssets)).toString();
  const liquidityAssetsUsd = safeParseFloat(totalDepositBalanceUSD) - safeParseFloat(totalBorrowBalanceUSD);

  const warningsWithDetail: WarningWithDetail[] = [];

  const marketDetail: Market = {
    id: marketId,
    uniqueKey: marketId,
    lltv: lltv,
    irmAddress: irmAddress as Address,
    collateralPrice: inputTokenPriceUSD,
    loanAsset: loanAsset,
    collateralAsset: collateralAsset,
    state: {
      borrowAssets: borrowAssets,
      supplyAssets: supplyAssets,
      borrowAssetsUsd: totalBorrowBalanceUSD,
      supplyAssetsUsd: totalDepositBalanceUSD,
      borrowShares: totalBorrowShares,
      supplyShares: totalSupplyShares,
      liquidityAssets: liquidityAssets,
      liquidityAssetsUsd: liquidityAssetsUsd,
      collateralAssets: collateralAssets,
      collateralAssetsUsd: collateralAssetsUsd,
      utilization: utilization,
      supplyApy: supplyApy,
      borrowApy: borrowApy,
      fee: safeParseFloat(fee) / 100,
      timestamp: timestamp,
      rateAtUTarget: 0,
    },
    oracleAddress: subgraphMarket.oracle?.oracleAddress ?? '0x',
    morphoBlue: {
      id: subgraphMarket.protocol?.id ?? '0x',
      address: subgraphMarket.protocol?.id ?? '0x',
      chain: {
        id: chainId,
      },
    },
    warnings: [],
    warningsWithDetail: warningsWithDetail,
    oracle: {
        data: defaultOracleData,
    },
    isProtectedByLiquidationBots: false,
    badDebt: undefined,
    realizedBadDebt: undefined,
  };

  return marketDetail;
};

// Hook to fetch a specific market using its ID (uniqueKey)
export const useSubgraphMarket = (uniqueKey: string | undefined, network: SupportedNetworks) => {
  return useQuery<Market | null>({ 
    queryKey: ['subgraphMarket', uniqueKey, network],
    queryFn: async () => {
      if (!uniqueKey || !network) return null;

      const subgraphApiUrl = getSubgraphUrl(network);

      if (!subgraphApiUrl) {
        console.error(`Subgraph URL for network ${network} is not defined.`);
        throw new Error(`Subgraph URL for network ${network} is not defined.`);
      }

      const response = await subgraphGraphqlFetcher<SubgraphMarketQueryResponse>(
          subgraphApiUrl,
          subgraphMarketQuery,
          {
            id: uniqueKey.toLowerCase()
          }
      );

      const marketData = response.data.market;

      if (!marketData) {
        console.warn(`Market with key ${uniqueKey} not found in Subgraph response.`);
        return null;
      }

      return transformSubgraphMarketToMarketDetail(marketData, network);
    },
    enabled: !!uniqueKey && !!network,
    staleTime: 1000 * 60 * 5,
  });
};
