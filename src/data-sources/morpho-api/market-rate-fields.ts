import { marketsRateFieldsQuery } from '@/graphql/morpho-api-queries';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { morphoGraphqlFetcher } from './fetchers';

type MorphoRateFields = Pick<
  Market['state'],
  | 'apyAtTarget'
  | 'rateAtTarget'
  | 'dailySupplyApy'
  | 'dailyBorrowApy'
  | 'weeklySupplyApy'
  | 'weeklyBorrowApy'
  | 'monthlySupplyApy'
  | 'monthlyBorrowApy'
>;

type MarketsRateFieldsGraphQLResponse = {
  data?: {
    markets?: {
      items?: {
        uniqueKey?: string;
        state?: MorphoRateFields;
      }[];
      pageInfo?: {
        countTotal: number;
      };
    };
  };
  errors?: { message: string }[];
};

const MORPHO_RATE_FIELDS_PAGE_SIZE = 500;
const MORPHO_RATE_FIELDS_TIMEOUT_MS = 20_000;

const getMorphoRateFieldsKey = (network: SupportedNetworks, uniqueKey: string): string => `${network}:${uniqueKey.toLowerCase()}`;

const toMorphoRateFields = (state: Partial<MorphoRateFields> | undefined): MorphoRateFields => ({
  apyAtTarget: state?.apyAtTarget ?? 0,
  rateAtTarget: state?.rateAtTarget ?? '0',
  dailySupplyApy: state?.dailySupplyApy ?? null,
  dailyBorrowApy: state?.dailyBorrowApy ?? null,
  weeklySupplyApy: state?.weeklySupplyApy ?? null,
  weeklyBorrowApy: state?.weeklyBorrowApy ?? null,
  monthlySupplyApy: state?.monthlySupplyApy ?? null,
  monthlyBorrowApy: state?.monthlyBorrowApy ?? null,
});

export const getMorphoMarketRateFieldsKey = getMorphoRateFieldsKey;

export const fetchMorphoMarketRateEnrichments = async (network: SupportedNetworks): Promise<Map<string, MorphoRateFields>> => {
  const enrichments = new Map<string, MorphoRateFields>();
  let skip = 0;

  while (true) {
    const response = await morphoGraphqlFetcher<MarketsRateFieldsGraphQLResponse>(
      marketsRateFieldsQuery,
      {
        first: MORPHO_RATE_FIELDS_PAGE_SIZE,
        skip,
        where: {
          chainId_in: [network],
        },
      },
      {
        timeoutMs: MORPHO_RATE_FIELDS_TIMEOUT_MS,
      },
    );

    if (!response?.data?.markets?.pageInfo) {
      throw new Error(`Morpho rate-fields response missing pageInfo for network ${network} at skip ${skip}.`);
    }

    if (!Array.isArray(response.data.markets.items)) {
      throw new Error(`Morpho rate-fields response missing items for network ${network} at skip ${skip}.`);
    }

    const { items, pageInfo } = response.data.markets;

    items.forEach((item) => {
      if (!item.uniqueKey || !item.state) {
        return;
      }

      enrichments.set(getMorphoRateFieldsKey(network, item.uniqueKey), toMorphoRateFields(item.state));
    });

    if (skip + items.length >= pageInfo.countTotal) {
      break;
    }

    skip += items.length;
  }

  return enrichments;
};
