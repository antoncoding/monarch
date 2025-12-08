import { formatUnits } from 'viem';
import { SupportedNetworks } from './networks';
import type { AssetVolumeData, Transaction } from './statsUtils';
import { findToken as findTokenStatic } from './tokens';

/**
 * Process transaction data to extract detailed asset metrics
 * This handles the supplies and withdrawals arrays in each transaction
 */
export const processTransactionData = (transactions: Transaction[], assetSymbolMap: Record<string, string>): AssetVolumeData[] => {
  console.log(`Processing ${transactions.length} transactions for detailed asset metrics`);

  // Initialize data structures to track metrics
  const assetMetrics: Record<string, AssetVolumeData> = {};
  const assetUsers: Record<string, Set<string>> = {};

  // Count number of supplies and withdrawals processed
  let suppliesProcessed = 0;
  let withdrawalsProcessed = 0;

  // Helper function to add an asset to tracking if not already present
  const initializeAssetTracking = (assetAddress: string, chainId: SupportedNetworks) => {
    const assetKey = `${chainId}-${assetAddress}`;

    if (!assetMetrics[assetKey]) {
      // Try to find token info using findToken
      const token = findTokenStatic(assetAddress, chainId);

      const symbol = token?.symbol ?? assetSymbolMap[assetAddress] ?? 'Unknown';

      console.log(`Initializing asset tracking for ${assetAddress} (${symbol}) on chain ${chainId}`);

      assetMetrics[assetKey] = {
        assetAddress,
        assetSymbol: symbol,
        chainId,
        supplyVolume: '0',
        withdrawVolume: '0',
        totalVolume: '0',
        supplyCount: 0,
        withdrawCount: 0,
        uniqueUsers: 0,
      };
      assetUsers[assetKey] = new Set<string>();
    }

    return assetKey;
  };

  // Process each transaction
  transactions.forEach((tx) => {
    // Use chainId from transaction or default to BASE_CHAIN_ID
    const chainId = tx.chainId ?? SupportedNetworks.Base;

    // Process supply events
    if (tx.supplies && Array.isArray(tx.supplies)) {
      tx.supplies.forEach((supply) => {
        // Skip malformed data
        if (!supply.market?.loan) {
          console.warn('Skipping supply event with missing market data');
          return;
        }

        const assetAddress = supply.market.loan.toLowerCase();

        // Initialize asset metrics if not already tracking this asset (with chain ID)
        const assetKey = initializeAssetTracking(assetAddress, chainId);

        // Update metrics
        const supplyVolumeBigInt = BigInt(supply.amount ?? '0');
        assetMetrics[assetKey].supplyVolume = (BigInt(assetMetrics[assetKey].supplyVolume) + supplyVolumeBigInt).toString();
        assetMetrics[assetKey].totalVolume = (BigInt(assetMetrics[assetKey].totalVolume) + supplyVolumeBigInt).toString();
        assetMetrics[assetKey].supplyCount += 1;

        // Track user
        assetUsers[assetKey].add(tx.user.toLowerCase());

        suppliesProcessed++;
      });
    }

    // Process withdrawal events
    if (tx.withdrawals && Array.isArray(tx.withdrawals)) {
      tx.withdrawals.forEach((withdrawal) => {
        // Skip malformed data
        if (!withdrawal.market?.loan) {
          console.warn('Skipping withdrawal event with missing market data');
          return;
        }

        const assetAddress = withdrawal.market.loan.toLowerCase();

        // Initialize asset metrics if not already tracking this asset (with chain ID)
        const assetKey = initializeAssetTracking(assetAddress, chainId);

        // Update metrics
        const withdrawVolumeBigInt = BigInt(withdrawal.amount ?? '0');
        assetMetrics[assetKey].withdrawVolume = (BigInt(assetMetrics[assetKey].withdrawVolume) + withdrawVolumeBigInt).toString();
        assetMetrics[assetKey].totalVolume = (BigInt(assetMetrics[assetKey].totalVolume) + withdrawVolumeBigInt).toString();
        assetMetrics[assetKey].withdrawCount += 1;

        // Track user
        assetUsers[assetKey].add(tx.user.toLowerCase());

        withdrawalsProcessed++;
      });
    }

    // Process transactions with no detailed events
    if (tx.supplies?.length === 0 && tx.withdrawals?.length === 0 && tx.market) {
      // Extract the asset address safely based on market format
      let assetAddress: string | undefined;

      if (typeof tx.market === 'string') {
        assetAddress = tx.market.toLowerCase();
      } else if (typeof tx.market === 'object' && tx.market !== null) {
        // Use type assertion to access market properties
        const marketObj = tx.market as { id?: string; loan?: string };
        assetAddress = marketObj.loan ? marketObj.loan.toLowerCase() : marketObj.id ? marketObj.id.toLowerCase() : undefined;
      }

      if (assetAddress) {
        // Initialize asset metrics if not already tracking this asset (with chain ID)
        const assetKey = initializeAssetTracking(assetAddress, chainId);

        // Add aggregated counts
        assetMetrics[assetKey].supplyCount += tx.supplyCount ?? 0;
        assetMetrics[assetKey].withdrawCount += tx.withdrawCount ?? 0;

        // Track user
        assetUsers[assetKey].add(tx.user.toLowerCase());

        // Add volumes
        const supplyVolumeBigInt = BigInt(tx.supplyVolume ?? '0');
        const withdrawVolumeBigInt = BigInt(tx.withdrawVolume ?? '0');

        assetMetrics[assetKey].supplyVolume = (BigInt(assetMetrics[assetKey].supplyVolume) + supplyVolumeBigInt).toString();
        assetMetrics[assetKey].withdrawVolume = (BigInt(assetMetrics[assetKey].withdrawVolume) + withdrawVolumeBigInt).toString();
        assetMetrics[assetKey].totalVolume = (
          BigInt(assetMetrics[assetKey].totalVolume) +
          supplyVolumeBigInt +
          withdrawVolumeBigInt
        ).toString();

        console.log(`Added aggregated data for ${assetAddress} from tx ${tx.id} on chain ${chainId}`);
      }
    }
  });

  // Calculate unique users for each asset
  Object.keys(assetMetrics).forEach((assetKey) => {
    assetMetrics[assetKey].uniqueUsers = assetUsers[assetKey].size;
  });

  console.log(`Data processing complete - processed ${suppliesProcessed} supplies and ${withdrawalsProcessed} withdrawals`);
  console.log(`Found ${Object.keys(assetMetrics).length} unique assets`);

  // Filter out assets with no transactions
  const filteredAssets = Object.values(assetMetrics).filter((asset) => asset.supplyCount > 0 || asset.withdrawCount > 0);

  // Sort by total transaction count descending
  return filteredAssets.sort((a, b) => {
    const totalCountA = a.supplyCount + a.withdrawCount;
    const totalCountB = b.supplyCount + b.withdrawCount;
    return totalCountB - totalCountA;
  });
};

/**
 * Calculate human-readable volumes for display
 */
export const calculateHumanReadableVolumes = (
  assetMetrics: AssetVolumeData[],
): (AssetVolumeData & {
  supplyVolumeFormatted: string;
  withdrawVolumeFormatted: string;
  totalVolumeFormatted: string;
})[] => {
  return assetMetrics.map((asset) => {
    // Find token to get decimals
    const token = findTokenStatic(asset.assetAddress, asset.chainId ?? SupportedNetworks.Base);
    const decimals = token?.decimals ?? 18;

    // Calculate formatted values
    const supplyVolumeFormatted = formatUnits(BigInt(asset.supplyVolume ?? '0'), decimals);
    const withdrawVolumeFormatted = formatUnits(BigInt(asset.withdrawVolume ?? '0'), decimals);
    const totalVolumeFormatted = formatUnits(BigInt(asset.totalVolume ?? '0'), decimals);

    return {
      ...asset,
      supplyVolumeFormatted,
      withdrawVolumeFormatted,
      totalVolumeFormatted,
    };
  });
};
