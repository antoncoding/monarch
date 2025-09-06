import { Address } from 'viem';
import { SupportedNetworks } from '@/utils/networks';
import { MorphoChainlinkOracleData } from '@/utils/types';

// Extend the oracle data structure to include optional warning codes
type WhitelistedOracleData = MorphoChainlinkOracleData & {
  warningCodes?: string[]; // Array of warning codes (e.g., 'hardcoded_oracle_feed')
};

// Define the structure for oracle data within a specific network
type NetworkOracleWhitelist = Record<Address, WhitelistedOracleData>;

// Top-level map: Network ID -> Oracle Address -> Oracle Data (including warnings)
export const oracleWhitelist: Partial<Record<SupportedNetworks, NetworkOracleWhitelist>> = {
  [SupportedNetworks.Polygon]: {
    '0x1dc2444b54945064c131145cd6b8701e3454c63a': {
      baseFeedOne: {
        address: '0x3Ea1eC855fBda8bA0396975eC260AD2e9B2Bc01c ',
        chain: { id: SupportedNetworks.Polygon },
        id: '0x3Ea1eC855fBda8bA0396975eC260AD2e9B2Bc01c',
        pair: ['wstETH', 'WETH'],
      },
      baseFeedTwo: null,
      quoteFeedOne: null,
      quoteFeedTwo: null,
      warningCodes: ['hardcoded_oracle_feed'],
    },
    '0x15b4e0ee3dc3d20d9d261da2d3e0d2a86a6a6291': {
      baseFeedOne: {
        address: '0xaca1222008C6Ea624522163174F80E6e17B0709A  ',
        chain: { id: SupportedNetworks.Polygon },
        id: '0xaca1222008C6Ea624522163174F80E6e17B0709A',
        pair: ['wBTC', 'USD'],
      },
      baseFeedTwo: null,
      quoteFeedOne: null,
      quoteFeedTwo: null,
      warningCodes: ['hardcoded_oracle_feed'],
    },
    '0xf6df1e9ac2a4239c81bde9a537236eb4b4a4828c': {
      baseFeedOne: {
        address: '0x66aCD49dB829005B3681E29b6F4Ba1d93843430e',
        chain: { id: SupportedNetworks.Polygon },
        id: '0x66aCD49dB829005B3681E29b6F4Ba1d93843430e',
        pair: ['MATIC', 'USD'],
      },
      baseFeedTwo: null,
      quoteFeedOne: null,
      quoteFeedTwo: null,
      warningCodes: ['hardcoded_oracle_feed'],
    },
    '0x8eece0e6a57554d70f4fa35913500d4c17ac3fef': {
      baseFeedOne: {
        address: '0xb6Cd28DD265aBbbF24a76B47353002ffeBd56099',
        chain: { id: SupportedNetworks.Polygon },
        id: '0xb6Cd28DD265aBbbF24a76B47353002ffeBd56099',
        pair: ['MaticX', 'USD'],
      },
      baseFeedTwo: null,
      quoteFeedOne: null,
      quoteFeedTwo: null,
      warningCodes: ['hardcoded_oracle_feed'],
    },
    '0xf81de2f51d33aca3b0ef672ae544d6225a0d76f2': {
      baseFeedOne: {
        address: '0xfBF4299519bdF63AE4296871b3a5237b09021B26',
        chain: { id: SupportedNetworks.Polygon },
        id: '0xfBF4299519bdF63AE4296871b3a5237b09021B26',
        pair: ['ETH', 'USD'],
      },
      baseFeedTwo: null,
      quoteFeedOne: null,
      quoteFeedTwo: null,
      warningCodes: ['hardcoded_oracle_feed'],
    },
    '0x3baefca1c626262e9140b7c789326235d9ffd16d': {
      baseFeedOne: {
        address: '0xaca1222008C6Ea624522163174F80E6e17B0709A',
        chain: { id: SupportedNetworks.Polygon },
        id: '0x0000000000000000000000000000000000000000',
        pair: ['WBTC', 'USD'],
      },
      baseFeedTwo: null,
      quoteFeedOne: {
        address: '0xfBF4299519bdF63AE4296871b3a5237b09021B26',
        chain: { id: SupportedNetworks.Polygon },
        id: '0xfBF4299519bdF63AE4296871b3a5237b09021B26',
        pair: ['ETH', 'USD'],
      },
      quoteFeedTwo: null,
      warningCodes: [],
    },
  },
};

/**
 * Gets the whitelisted oracle data (including potential warnings) for a specific oracle address and network.
 * @param oracleAddress The address of the oracle contract.
 * @param network The network ID.
 * @returns The WhitelistedOracleData if found, otherwise undefined.
 */
export const getWhitelistedOracleData = (
  oracleAddress: Address,
  network: SupportedNetworks,
): WhitelistedOracleData | undefined => {
  return oracleWhitelist[network]?.[oracleAddress];
};
