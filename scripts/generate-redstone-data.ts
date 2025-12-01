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

// Mapping of tokens to their underlying/pegged assets
// Used for FUNDAMENTAL feeds to determine the correct quote asset
const TOKEN_PEG_MAPPING: Record<string, string> = {
  // BTC-pegged tokens
  lbtc: 'btc',
  wbtc: 'btc',
  cbbtc: 'btc',
  tbtc: 'btc',
  ebtc: 'btc',
  ubtc: 'btc',
  solvbtc: 'btc',
  pumpbtc: 'btc',
  bfbtc: 'btc',
  tacbtc: 'btc',

  // ETH-pegged tokens
  weth: 'eth',
  cbeth: 'eth',
  reth: 'eth',
  wsteth: 'eth',
  weeth: 'eth',
  ezeth: 'eth',
  oseth: 'eth',
  pufeth: 'eth',
  rseth: 'eth',
  rsweth: 'eth',
  apxeth: 'eth',
  bsdeth: 'eth',
  ueth: 'eth',
  'eth+': 'eth',
  sweth: 'eth',
  pzeth: 'eth',
  egeth: 'eth',
  taceth: 'eth',
  cmeth: 'eth',

  // USD-pegged tokens
  usdc: 'usd',
  usdt: 'usd',
  dai: 'usd',
  usde: 'usd',
  usds: 'usd',
  frax: 'usd',
  pyusd: 'usd',
  eusd: 'usd',
  ausd: 'usd',
  crvusd: 'usd',
  usda: 'usd',
  usd0: 'usd',
  usdhl: 'usd',
  usdt0: 'usd',
  usdz: 'usd',
  ush: 'usd',
  usyc: 'usd',
  usr: 'usd',
  hyusd: 'usd',
  usd3: 'usd',
  deusd: 'usd',
  fxusd: 'usd',
  usdx: 'usd',
  yusd: 'usd',
  tacusd: 'usd',
  cusd: 'usd',

  // Staked/wrapped versions of stablecoins
  susde: 'usde',
  sdai: 'dai',
  susds: 'usds',
  syusd: 'yusd',

  // SOL-pegged
  usol: 'sol',

  // MATIC/POL
  maticx: 'pol',
  wpol: 'pol',

  // HYPE-pegged
  sthype: 'hype',
  mhype: 'hype',
  khype: 'hype',
  hbhype: 'hype',
  lsthype: 'hype',
  behype: 'hype',

  // Other pegged tokens
  hbusdt: 'usdt',
  hbbtc: 'btc',

  // Interest-bearing tokens
  buidl: 'usd',
  buidl_i_ethereum: 'usd',
  vbill_ethereum: 'usd',
  usdtb: 'usd',
  thbill: 'usd',
  ibenji_ethereum: 'usd',

  // Specific fundamental tokens
  acred: 'usd',
  stac: 'usd',
  sierra: 'usd',
  hlscope: 'usd',
  hwhlp: 'usd',
  rlp: 'usd',
  susde_fundamental: 'usde',
  susdx_eth: 'eth',
  berastone: 'usd',
};

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
    // For FUNDAMENTAL feeds, try to find the pegged asset
    const pegAsset = TOKEN_PEG_MAPPING[baseNameLower];
    if (pegAsset) {
      return `${baseNameLower}/${pegAsset}`;
    }
    // If no mapping found, use "unknown" as quote
    return `${baseNameLower}/unknown`;
  }

  // For non-fundamental feeds, default to USD pair
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
