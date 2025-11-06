import { Address, decodeAbiParameters, encodeAbiParameters, keccak256, parseAbiParameters, zeroAddress } from 'viem';
import { Market as BlueMarket, MarketParams as BlueMarketParams } from '@morpho-org/blue-sdk';
import { SupportedNetworks } from './networks';
import { Market, MarketParams, UserTxTypes } from './types';
// appended to the end of datahash to identify a monarch tx
export const MONARCH_TX_IDENTIFIER = 'beef';

export const getMorphoAddress = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Mainnet:
      return '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
    case SupportedNetworks.Base:
      return '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
    case SupportedNetworks.Polygon:
      return '0x1bf0c2541f820e775182832f06c0b7fc27a25f67';
    case SupportedNetworks.Unichain:
      return '0x8f5ae9cddb9f68de460c77730b018ae7e04a140a';
    case SupportedNetworks.Arbitrum:
      return '0x6c247b1F6182318877311737BaC0844bAa518F5e';
    case SupportedNetworks.HyperEVM:
      return '0x68e37dE8d93d3496ae143F2E900490f6280C57cD';
    default:
      return zeroAddress;
  }
};

export const getBundlerV2 = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Mainnet:
      return '0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077';
    case SupportedNetworks.Base:
      // ChainAgnosticBundlerV2
      return '0x23055618898e202386e6c13955a58D3C68200BFB';
    case SupportedNetworks.Polygon:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.Unichain:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.Arbitrum:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    case SupportedNetworks.HyperEVM:
      return '0x5738366B9348f22607294007e75114922dF2a16A'; // ChainAgnosticBundlerV2 we deployed
    default:
      return zeroAddress;
  }
};

export const getIRMTitle = (address: string) => {
  switch (address.toLowerCase()) {
    case '0x870ac11d48b15db9a138cf899d20f13f79ba00bc':
      return 'Adaptive Curve';
    case '0x46415998764c29ab2a25cbea6254146d50d22687': // on base
      return 'Adaptive Curve';
    case '0xe675a2161d4a6e2de2eed70ac98eebf257fbf0b0': // on polygon
      return 'Adaptive Curve';
    case '0x9a6061d51743b31d2c3be75d83781fa423f53f0e': // on unichain
      return 'Adaptive Curve';
    case '0x66f30587fb8d4206918deb78eca7d5ebbafd06da': // on arbitrum
      return 'Adaptive Curve';
    case '0xd4a426f010986dcad727e8dd6eed44ca4a9b7483': // on hyperevm
      return 'Adaptive Curve';
    default:
      return 'Unknown IRM';
  }
};

export const actionTypeToText = (type: UserTxTypes) => {
  switch (type) {
    case UserTxTypes.MarketBorrow:
      return 'Borrow';
    case UserTxTypes.MarketSupply:
      return 'Supply';
    case UserTxTypes.MarketWithdraw:
      return 'Withdraw';
    default:
      return type;
  }
};

const MAINNET_GENESIS_DATE = new Date('2023-12-28T09:09:23.000Z');

export function getMorphoGenesisDate(chainId: number): Date {
  switch (chainId) {
    case SupportedNetworks.Mainnet:
      return new Date('2023-12-28T09:09:23.000Z');
    case SupportedNetworks.Base:
      return new Date('2024-05-03T13:40:43.000Z');
    case SupportedNetworks.Polygon:
      return new Date('2025-01-20T02:03:12.000Z');;
    case SupportedNetworks.Unichain:
      return new Date('2025-02-18T02:03:6.000Z');
    case SupportedNetworks.Arbitrum:
      return new Date('2025-01-17T06:04:51.000Z');
    case SupportedNetworks.HyperEVM:
      return new Date('2025-04-03T04:52:00.000Z');
    default:
      return MAINNET_GENESIS_DATE; // default to mainnet
  }
}

// ============================================================================
// Cap ID Utilities for Morpho Market Adapters
// ============================================================================


export function getAdapterCapId(adapterAddress: Address): {params: string, id: string} {
  // Solidity 
  // adapterId = keccak256(abi.encode("this", address(this)));
  const params = encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }],
    ["this", adapterAddress]
  )

  return { params, id: keccak256(params)}
}

export function getCollateralCapId(collateralToken: Address): {params: string, id: string} {
  // Solidity
  // id = keccak256(abi.encode("collateralToken", marketParams.collateralToken));
  const params = encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }],
    ["collateralToken", collateralToken]
  )

  return { params, id: keccak256(params)}
}

export function getMarketCapId(adopterAddress: Address, marketParams: MarketParams): {params: string, id: string} {
  // Solidity
  // id = keccak256(abi.encode("this/marketParams", address(this), marketParams));
  const encoded = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'address' },
      {
        type: 'tuple',
        components: [
          { type: 'address', name: 'loanToken' },
          { type: 'address', name: 'collateralToken' },
          { type: 'address', name: 'oracle' },
          { type: 'address', name: 'irm' },
          { type: 'uint256', name: 'lltv' }
        ]
      }
    ],
    [
      'this/marketParams',
      adopterAddress,
      {
        loanToken: marketParams.loanToken,
        collateralToken: marketParams.collateralToken,
        oracle: marketParams.oracle,
        irm: marketParams.irm,
        lltv: marketParams.lltv
      }
    ]
  )
  const id = keccak256(encoded)

  return { params: encoded, id }
}

/**
 * Parses the encoded idParams to determine the cap type and extract relevant data.
 *
 * @param idParams - The encoded ABI parameters (hex string starting with 0x)
 * @returns Object containing the cap type and extracted addresses/marketId
 */
export function parseCapIdParams(idParams: string): {
  type: 'adapter' | 'collateral' | 'market' | 'unknown';
  adapterAddress?: Address;
  collateralToken?: Address;
  marketParams?: MarketParams;
  marketId?: string;
} {
  try {
    // First, try to decode as adapter cap: (string, address)
    // Pattern: ("this", adapterAddress)
    try {
      const decoded = decodeAbiParameters(
        [{ type: 'string' }, { type: 'address' }],
        idParams as `0x${string}`
      );

      if (decoded[0] === 'this') {
        return {
          type: 'adapter',
          adapterAddress: decoded[1] as Address,
        };
      }

      if (decoded[0] === 'collateralToken') {
        return {
          type: 'collateral',
          collateralToken: decoded[1] as Address,
        };
      }
    } catch {
      // Not a simple (string, address) pattern, try market pattern
    }

    // Try to decode as market cap: (string, address, marketParams)
    // Pattern: ("this/marketParams", adapterAddress, marketParams)
    try {
      const marketParamsType = parseAbiParameters('(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)');
      const marketParamsComponents = parseAbiParameters(
        '(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
      );

      const decoded = decodeAbiParameters(
        [
          { type: 'string' },
          { type: 'address' },
          { type: 'tuple', components: marketParamsComponents },
        ],
        idParams as `0x${string}`,
      );

      if (decoded[0] === 'this/marketParams') {

        const marketParamsBlock = decoded[2] as [any];

        const marketParams = marketParamsBlock[0] as any as MarketParams;

        // Create a market ID hash from the market params
        const marketId = keccak256(encodeAbiParameters(marketParamsType, [marketParams]));

        return {
          type: 'market',
          adapterAddress: decoded[1] as Address,
          marketParams,
          marketId,
        };
      }
    } catch {
      // Not a market pattern
    }

    // Fallback: could not decode
    return { type: 'unknown' };
  } catch (error) {
    console.error('Error parsing idParams:', error);
    return { type: 'unknown' };
  }
}

// ============================================================================
// Supply Preview Utilities
// ============================================================================

type MarketStatePreview = {
  supplyApy: number;
  borrowApy: number;
  utilization: number; // scaled down WAD
  totalSupplyAssets: bigint;
  totalBorrowAssets: bigint;
  liquidityAssets: bigint;
};

/**
 * Simulates a supply operation and returns the full market state preview.
 *
 * @param market - The market configuration and state
 * @param supplyAmount - The amount to simulate supplying (in asset units, positive for supply)
 * @returns The estimated market state after the action, or null if simulation fails
 */
export function previewMarketState(market: Market, supplyAmount: bigint): MarketStatePreview | null {
  try {
    const params = new BlueMarketParams({
      loanToken: market.loanAsset.address as Address,
      collateralToken: market.collateralAsset.address as Address,
      oracle: market.oracleAddress as Address,
      irm: market.irmAddress as Address,
      lltv: BigInt(market.lltv),
    });

    console.log('market.state.rateAtTarget', market.state.rateAtTarget)


    const blueMarket = new BlueMarket({
      params,
      totalSupplyAssets: BigInt(market.state.supplyAssets),
      totalBorrowAssets: BigInt(market.state.borrowAssets),
      totalSupplyShares: BigInt(market.state.supplyShares),
      totalBorrowShares: BigInt(market.state.borrowShares),
      lastUpdate: BigInt(market.state.timestamp), // not really the last timestamp but doesn't matter.
      rateAtTarget: BigInt(market.state.rateAtTarget),
      fee: BigInt(Math.floor(market.state.fee * 1e18)),
    });

    console.log('pre apy at target', market.state.supplyApy)

    const { market: updated } = blueMarket.supply(supplyAmount, 0n);

    return {
      supplyApy: updated.supplyApy,
      borrowApy: updated.borrowApy,
      utilization: Number(updated.utilization) / 1e18,
      totalSupplyAssets: updated.totalSupplyAssets,
      totalBorrowAssets: updated.totalBorrowAssets,
      liquidityAssets: updated.liquidity,
    };
  } catch (error) {
    console.error('Error previewing market state:', error);
    return null;
  }
}
