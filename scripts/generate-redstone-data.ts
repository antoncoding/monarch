#!/usr/bin/env tsx

import { writeFileSync } from 'fs';
import { join } from 'path';

type RawRedstoneConfig = {
  chain: {
    name: string;
    id: number;
  };
  updateTriggers: {
    deviationPercentage: number;
    timeSinceLastUpdateInMilliseconds: number;
  };
  adapterContract: string;
  adapterContractType: string;
  dataServiceId: string;
  priceFeeds: {
    [key: string]: {
      priceFeedAddress: string;
      updateTriggersOverrides?: {
        deviationPercentage?: number;
        timeSinceLastUpdateInMilliseconds?: number;
        [key: string]: any;
      };
    };
  };
  [key: string]: any;
};

type CleanRedstoneEntry = {
  path: string;
  priceFeedAddress: string;
  fundamental: boolean;
  dataServiceId: string;
  heartbeat: number;
  threshold: number;
};

const BASE_URL =
  'https://raw.githubusercontent.com/redstone-finance/redstone-oracles-monorepo/main/packages/relayer-remote-config/main/relayer-manifests-multi-feed';


const ENDPOINTS = {
  mainnet: 'ethereumMultiFeed.json',
  base: 'baseMultiFeed.json',
  polygon: 'polygonMultiFeed.json',
  arbitrum: 'arbitrumOneMultiFeed.json',
  hyperevm: 'hyperevmMultiFeed.json',
  monad: 'monadMultiFeed.json',
} as const;

/**
 * Mapping of derivative tokens to their underlying assets
 *
 * For FUNDAMENTAL feeds, Redstone tracks the on-chain exchange rate between
 * an underlying asset and its derivative (e.g., wstETH/stETH from Lido).
 * This mapping determines the correct quote asset for fundamental price feeds.
 *
 * Examples:
 * - wstETH (derivative) -> ETH (underlying asset)
 * - LBTC (derivative) -> BTC (underlying asset)
 * - sUSDe (derivative) -> USDe (underlying asset)
 */
const FUNDAMENTAL_TO_UNDERLYING_MAPPING: Record<string, string> = {
  // BTC derivative tokens -> BTC underlying
  lbtc: 'btc',
  
  // ETH derivative tokens -> ETH underlying
  susde: 'usde',

  reth: 'eth',
  weeth: 'eth',
  ezeth: 'eth',
  oseth: 'eth',
  pufeth: 'eth',
  wsteth: 'eth',
  
  // HYPE derivative tokens -> HYPE underlying
  sthype: 'hype',
  mhype: 'hype',
  khype: 'hype',
  hbhype: 'hype',
  lsthype: 'hype',

  // Other derivative tokens
  hbusdt: 'usdt',
  hbbtc: 'btc',

  thbill: 'usd',
};

/**
 * Generates the price feed path for a Redstone feed
 *
 * For FUNDAMENTAL feeds: Returns derivative/underlying pair (e.g., "wsteth/eth")
 * For STANDARD feeds: Returns token/usd pair (e.g., "btc/usd")
 *
 * @param feedName - The raw feed name from Redstone config
 * @param isFundamental - Whether this is a fundamental (contract rate) feed
 * @returns The normalized path in format "base/quote"
 */
const generatePath = (feedName: string, isFundamental: boolean): string => {
  // Check if the feed already contains a pair (e.g., "eBTC/WBTC" or "stHYPE/HYPE")
  if (feedName.includes('/')) {
    return feedName.toLowerCase();
  }

  // Strip _FUNDAMENTAL and other suffixes if present
  const baseName = feedName
    .replace(/_FUNDAMENTAL$/i, '')
    .replace(/_DAILY_ACCRUAL$/i, '')
    .replace(/_DAILY_INTEREST_ACCRUAL$/i, '')
    .replace(/_ETHEREUM$/i, '')
    .replace(/_ETH$/i, '');

  const baseNameLower = baseName.toLowerCase();

  if (isFundamental) {
    // For FUNDAMENTAL feeds, find the underlying asset the derivative tracks
    // e.g., wstETH (derivative) tracks its exchange rate to ETH (underlying)
    const underlyingAsset = FUNDAMENTAL_TO_UNDERLYING_MAPPING[baseNameLower];
    if (underlyingAsset) {
      return `${baseNameLower}/${underlyingAsset}`;
    }
    // If no mapping found, use "unknown" as underlying asset
    return `${baseNameLower}/unknown`;
  }

  // For STANDARD (market) feeds, default to USD pair
  return `${baseNameLower}/usd`;
};

const isFundamental = (feedName: string): boolean => {
  return feedName.endsWith('_FUNDAMENTAL');
};

const cleanRedstoneEntry = (
  feedName: string,
  feedData: {
    priceFeedAddress: string;
    updateTriggersOverrides?: {
      deviationPercentage?: number;
      timeSinceLastUpdateInMilliseconds?: number;
      [key: string]: any;
    };
  },
  config: RawRedstoneConfig,
): CleanRedstoneEntry => {
  // Use override values if they exist, otherwise use global values
  const heartbeatMs =
    feedData.updateTriggersOverrides?.timeSinceLastUpdateInMilliseconds ??
    config.updateTriggers.timeSinceLastUpdateInMilliseconds;
  const threshold =
    feedData.updateTriggersOverrides?.deviationPercentage ??
    config.updateTriggers.deviationPercentage;

  const fundamental = isFundamental(feedName);

  return {
    path: generatePath(feedName, fundamental),
    priceFeedAddress: feedData.priceFeedAddress,
    fundamental,
    dataServiceId: config.dataServiceId,
    heartbeat: Math.floor(heartbeatMs / 1000),
    threshold,
  };
};

const fetchAndProcessData = async (
  network: keyof typeof ENDPOINTS,
): Promise<CleanRedstoneEntry[]> => {
  console.log(`Fetching ${network} Redstone oracle data...`);

  try {
    const url = `${BASE_URL}/${ENDPOINTS[network]}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${network} data: ${response.statusText}`);
    }

    const rawConfig: RawRedstoneConfig = await response.json();
    const priceFeeds = rawConfig.priceFeeds;

    console.log(`Found ${Object.keys(priceFeeds).length} price feeds for ${network}`);

    const cleanEntries = Object.entries(priceFeeds).map(([feedName, feedData]) =>
      cleanRedstoneEntry(feedName, feedData, rawConfig),
    );

    return cleanEntries;
  } catch (error) {
    console.error(`Error fetching ${network} data:`, error);
    throw error;
  }
};

const writeJsonFile = (filename: string, data: CleanRedstoneEntry[]): void => {
  const outputPath = join(
    process.cwd(),
    'src',
    'constants',
    'oracle',
    'redstone-data',
    `${filename}.json`,
  );
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Written ${data.length} entries to ${filename}.json`);
};

const main = async (): Promise<void> => {
  console.log('Starting Redstone oracle data generation...\n');

  try {
    const networks = Object.keys(ENDPOINTS) as Array<keyof typeof ENDPOINTS>;

    for (const network of networks) {
      const cleanData = await fetchAndProcessData(network);
      writeJsonFile(network, cleanData);
    }

    console.log('\n✅ All Redstone oracle data files generated successfully!');
  } catch (error) {
    console.error('\n❌ Error generating Redstone oracle data:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
