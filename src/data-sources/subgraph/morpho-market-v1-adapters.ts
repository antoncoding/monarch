import { Address } from 'viem';
import { morphoMarketV1AdaptersQuery } from '@/graphql/morpho-market-v1-adapter-queries';
import { subgraphGraphqlFetcher } from './fetchers';

type MorphoMarketV1AdaptersResponse = {
  data?: {
    createMorphoMarketV1Adapters: {
      id: string;
      parentVault: string;
      morpho: string;
      morphoMarketV1Adapter: string;
    }[];
  };
};

export type MorphoMarketV1AdapterRecord = {
  id: string;
  adapter: Address;
  parentVault: Address;
  morpho: Address;
};

export async function fetchMorphoMarketV1Adapters({
  subgraphUrl,
  parentVault,
  morpho,
}: {
  subgraphUrl: string;
  parentVault: Address;
  morpho: Address;
}): Promise<MorphoMarketV1AdapterRecord[]> {
  const response = await subgraphGraphqlFetcher<MorphoMarketV1AdaptersResponse>(
    subgraphUrl,
    morphoMarketV1AdaptersQuery,
    {
      parentVault: parentVault.toLowerCase(),
      morpho: morpho.toLowerCase(),
    },
  );

  const adapters = response.data?.createMorphoMarketV1Adapters ?? [];

  return adapters.map((adapter) => ({
    id: adapter.id,
    adapter: adapter.morphoMarketV1Adapter as Address,
    parentVault: adapter.parentVault as Address,
    morpho: adapter.morpho as Address,
  }));
}
