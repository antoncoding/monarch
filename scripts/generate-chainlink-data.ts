#!/usr/bin/env tsx

import { writeFileSync } from 'fs';
import { join } from 'path';

type RawOracleEntry = {
  contractAddress: string;
  contractVersion: number;
  ens: string;
  heartbeat: number;
  multiply: string;
  name: string;
  path: string;
  proxyAddress: string;
  threshold: number;
  assetName: string;
  feedCategory: 'low' | 'medium' | 'high' | 'custom';
  feedType: string;
  decimals: number;
  docs: {
    baseAsset?: string;
    quoteAsset?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type CleanOracleEntry = {
  ens: string;
  heartbeat: number;
  path: string;
  proxyAddress: string;
  threshold: number;
  feedCategory: 'low' | 'medium' | 'high' | 'custom';
  baseAsset: string;
  quoteAsset: string;
  isSVR: boolean;
};

const ENDPOINTS = {
  mainnet: 'https://reference-data-directory.vercel.app/feeds-mainnet.json',
  base: 'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-base-1.json',
  polygon: 'https://reference-data-directory.vercel.app/feeds-polygon-mainnet-katana.json',
  arbitrum: 'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-arbitrum-1.json',
} as const;

const cleanOracleEntry = (entry: RawOracleEntry): CleanOracleEntry => {
  // this data entry is coorupted as teh time we generate
  if (entry.proxyAddress === '0x0D03E26E0B5D09E24E5a45696D0FcA12E9648FBB') {
    entry.docs.quoteAsset = 'USD';
  }

  return {
    ens: entry.ens,
    heartbeat: entry.heartbeat,
    path: entry.path,
    proxyAddress: entry.proxyAddress ?? '',
    threshold: entry.threshold,
    feedCategory: entry.feedCategory,
    baseAsset: entry.docs?.baseAsset ?? '',
    quoteAsset: entry.docs?.quoteAsset ?? '',
    isSVR: entry.path.endsWith('-svr'),
  };
};

const fetchAndProcessData = async (
  network: keyof typeof ENDPOINTS,
): Promise<CleanOracleEntry[]> => {
  console.log(`Fetching ${network} oracle data...`);

  try {
    const response = await fetch(ENDPOINTS[network]);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${network} data: ${response.statusText}`);
    }

    const rawData: RawOracleEntry[] = await response.json();
    console.log(`Found ${rawData.length} oracles for ${network}`);

    return rawData.map(cleanOracleEntry);
  } catch (error) {
    console.error(`Error fetching ${network} data:`, error);
    throw error;
  }
};

const writeJsonFile = (filename: string, data: CleanOracleEntry[]): void => {
  const outputPath = join(
    process.cwd(),
    'src',
    'constants',
    'oracle',
    'chainlink-data',
    `${filename}.json`,
  );
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Written ${data.length} entries to ${filename}.json`);
};

const main = async (): Promise<void> => {
  console.log('Starting Chainlink oracle data generation...\n');

  try {
    const networks = Object.keys(ENDPOINTS) as Array<keyof typeof ENDPOINTS>;

    for (const network of networks) {
      const cleanData = await fetchAndProcessData(network);
      writeJsonFile(network, cleanData);
    }

    console.log('\n✅ All oracle data files generated successfully!');
  } catch (error) {
    console.error('\n❌ Error generating oracle data:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
