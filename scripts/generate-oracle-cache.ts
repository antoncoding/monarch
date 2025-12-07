#!/usr/bin/env tsx

import { writeFileSync } from 'fs';
import { join } from 'path';
import { oraclesQuery } from '../src/graphql/morpho-api-queries';
import { ALL_SUPPORTED_NETWORKS } from "../src/utils/networks"
import { URLS } from '../src/utils/urls';

// Types matching Morpho API oracle response
type OracleFeed = {
  address: string;
  chain: {
    id: number;
  };
  description: string | null;
  id: string;
  pair: string[] | null;
  vendor: string | null;
};

type MorphoChainlinkOracleData = {
  baseFeedOne: OracleFeed | null;
  baseFeedTwo: OracleFeed | null;
  quoteFeedOne: OracleFeed | null;
  quoteFeedTwo: OracleFeed | null;
};

type OracleItem = {
  address: string;
  chain: {
    id: number;
  };
  data: MorphoChainlinkOracleData | null;
};

type OraclesQueryResponse = {
  data: {
    oracles: {
      items: OracleItem[];
      pageInfo: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
  errors?: { message: string }[];
};

// Cached oracle entry for storage
type CachedOracleEntry = {
  address: string;
  chainId: number;
  data: MorphoChainlinkOracleData;
};

const MORPHO_API_URL = URLS.MORPHO_BLUE_API;
const SUPPORTED_NETWORKS = ALL_SUPPORTED_NETWORKS;

const fetchOraclesForChain = async (chainId: number): Promise<OracleItem[]> => {
  const allOracles: OracleItem[] = [];
  let skip = 0;
  const pageSize = 1000;

  console.log(`\n🔍 Fetching oracles for chain ${chainId}...`);

  try {
    while (true) {
      const variables = {
        first: pageSize,
        skip,
        where: {
          chainId_in: [chainId],
        },
      };

      console.log(`  📡 Making request: skip=${skip}, pageSize=${pageSize}`);

      const response = await fetch(MORPHO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: oraclesQuery, variables }),
      });

      console.log(`  📨 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ❌ Response body:`, errorText);
        throw new Error(
          `Failed to fetch oracles for chain ${chainId}: ${response.status} ${response.statusText}\nBody: ${errorText}`,
        );
      }

      const result = (await response.json()) as OraclesQueryResponse;

      if (result.errors) {
        console.error(`  ❌ GraphQL errors for chain ${chainId}:`, JSON.stringify(result.errors, null, 2));
        throw new Error(`GraphQL query failed: ${JSON.stringify(result.errors)}`);
      }

      if (!result.data) {
        console.error(`  ❌ No data field in response for chain ${chainId}`);
        console.error(`  Full response:`, JSON.stringify(result, null, 2));
        break;
      }

      const items = result.data?.oracles?.items;
      if (!items || items.length === 0) {
        console.log(`  ℹ️  No more items (received ${items?.length ?? 0} items)`);
        break;
      }

      allOracles.push(...items);

      console.log(
        `  ✅ Fetched ${items.length} oracles (skip: ${skip}, total so far: ${allOracles.length})`,
      );

      // Check if we've fetched all
      if (items.length < pageSize) {
        console.log(`  ℹ️  Last page reached (${items.length} < ${pageSize})`);
        break;
      }

      skip += pageSize;
    }

    console.log(`✅ Completed chain ${chainId}: ${allOracles.length} total oracles\n`);
    return allOracles;
  } catch (error) {
    console.error(`\n❌ Error fetching oracles for chain ${chainId}:`);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error(`   Error:`, error);
    }
    return []; // Return empty array on error, don't crash the whole script
  }
};

const main = async (): Promise<void> => {
  console.log('🚀 Starting oracle cache generation from Morpho API...');
  console.log(`📍 API Endpoint: ${MORPHO_API_URL}`);
  console.log(`🌐 Networks: ${SUPPORTED_NETWORKS.join(', ')}\n`);

  try {
    const allCachedOracles: CachedOracleEntry[] = [];
    const chainStats = new Map<number, number>();

    // Fetch oracles for each chain
    for (const chainId of SUPPORTED_NETWORKS) {
      console.log(`\n${'='.repeat(60)}`);
      const oracles = await fetchOraclesForChain(chainId);

      // Filter out oracles without data and convert to cached format
      let withData = 0;
      let withoutData = 0;

      for (const oracle of oracles) {
        if (oracle.data) {
          allCachedOracles.push({
            address: oracle.address.toLowerCase(), // Normalize to lowercase
            chainId: oracle.chain.id,
            data: oracle.data,
          });
          withData++;
        } else {
          withoutData++;
        }
      }

      chainStats.set(chainId, withData);
      console.log(`  📊 Chain ${chainId} stats: ${withData} with data, ${withoutData} without data`);
    }

    // Write to oracle-cache.json
    const outputPath = join(
      process.cwd(),
      'src',
      'constants',
      'oracle',
      'oracle-cache.json',
    );

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n💾 Writing oracle cache to file...`);

    writeFileSync(outputPath, JSON.stringify(allCachedOracles, null, 2));

    console.log(`\n✅ Successfully generated oracle cache!`);
    console.log(`   📁 Total oracles cached: ${allCachedOracles.length}`);
    console.log(`   📂 Output: ${outputPath}`);

    // Print statistics by chain
    console.log('\n📊 Oracles by chain:');
    const sortedChains = Array.from(chainStats.entries()).sort((a, b) => b[1] - a[1]);
    sortedChains.forEach(([chainId, count]) => {
      console.log(`   Chain ${chainId}: ${count} oracles`);
    });

    console.log(`\n🎉 Done!\n`);
  } catch (error) {
    console.error('\n❌ Fatal error generating oracle cache:');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack:`, error.stack);
    } else {
      console.error(`   Error:`, error);
    }
    process.exit(1);
  }
};

if (require.main === module) {
  main().then(console.log).catch(console.error);
}
