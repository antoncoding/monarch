import { formatUnits, type Address, type PublicClient } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { fetchBlocksWithTimestamps, type BlockWithTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

const PARALLEL_BATCH_SIZE = 6;

export type RpcVaultHistoryPoint = {
  blockNumber: number;
  timestamp: number;
  value: number;
};

export type RpcVaultHistory = {
  sharePrice: RpcVaultHistoryPoint[];
  totalAssets: RpcVaultHistoryPoint[];
};

type FetchRpcVaultHistoryArgs = {
  assetDecimals: number;
  chainId: SupportedNetworks;
  endTimestamp: number;
  intervalSeconds: number;
  startTimestamp: number;
  vaultAddress: Address;
  customRpcUrl?: string;
};

function calculateTimePoints(startTimestamp: number, endTimestamp: number, intervalSeconds: number): number[] {
  const points: number[] = [];

  for (let timestamp = startTimestamp; timestamp < endTimestamp; timestamp += intervalSeconds) {
    points.push(timestamp);
  }

  points.push(endTimestamp);
  return points;
}

async function fetchVaultHistoryPoint(
  client: PublicClient,
  vaultAddress: Address,
  oneShareUnit: bigint,
  assetDecimals: number,
  block: BlockWithTimestamp,
): Promise<{ sharePrice?: RpcVaultHistoryPoint; totalAssets?: RpcVaultHistoryPoint }> {
  try {
    const [totalAssetsResult, sharePriceResult] = await client.multicall({
      blockNumber: BigInt(block.blockNumber),
      allowFailure: true,
      contracts: [
        {
          address: vaultAddress,
          abi: vaultv2Abi,
          functionName: 'totalAssets',
        },
        {
          address: vaultAddress,
          abi: vaultv2Abi,
          functionName: 'previewRedeem',
          args: [oneShareUnit],
        },
      ],
    });
    const point = { blockNumber: block.blockNumber, timestamp: block.targetTimestamp };
    const totalAssets = totalAssetsResult.status === 'success' ? Number(formatUnits(totalAssetsResult.result, assetDecimals)) : Number.NaN;
    const sharePrice = sharePriceResult.status === 'success' ? Number(formatUnits(sharePriceResult.result, assetDecimals)) : Number.NaN;

    return {
      totalAssets: Number.isFinite(totalAssets) ? { ...point, value: totalAssets } : undefined,
      sharePrice: Number.isFinite(sharePrice) ? { ...point, value: sharePrice } : undefined,
    };
  } catch {
    return {};
  }
}

export async function fetchRpcVaultHistory({
  assetDecimals,
  chainId,
  customRpcUrl,
  endTimestamp,
  intervalSeconds,
  startTimestamp,
  vaultAddress,
}: FetchRpcVaultHistoryArgs): Promise<RpcVaultHistory> {
  const client = getClient(chainId, customRpcUrl);
  const [currentBlock, shareDecimals] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({
      address: vaultAddress,
      abi: vaultv2Abi,
      functionName: 'decimals',
    }),
  ]);
  const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
  const currentTimestamp = Number(currentBlockData.timestamp);
  const boundedEndTimestamp = Math.min(endTimestamp, currentTimestamp);
  const targetTimestamps = calculateTimePoints(Math.min(startTimestamp, boundedEndTimestamp), boundedEndTimestamp, intervalSeconds);
  const blocks = await fetchBlocksWithTimestamps(client, chainId, targetTimestamps, Number(currentBlock), currentTimestamp);
  const oneShareUnit = 10n ** BigInt(shareDecimals);
  const sharePrice: RpcVaultHistoryPoint[] = [];
  const totalAssets: RpcVaultHistoryPoint[] = [];

  for (let index = 0; index < blocks.length; index += PARALLEL_BATCH_SIZE) {
    const batch = blocks.slice(index, index + PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((block) => fetchVaultHistoryPoint(client, vaultAddress, oneShareUnit, assetDecimals, block)),
    );

    for (const result of results) {
      if (result.totalAssets) totalAssets.push(result.totalAssets);
      if (result.sharePrice) sharePrice.push(result.sharePrice);
    }
  }

  return {
    sharePrice: sharePrice.sort((left, right) => left.timestamp - right.timestamp),
    totalAssets: totalAssets.sort((left, right) => left.timestamp - right.timestamp),
  };
}
