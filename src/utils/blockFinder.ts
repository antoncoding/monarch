import { type PublicClient } from 'viem';
import { SupportedNetworks } from './networks';
import { BLOCK_TIME } from './rpc';

type BlockInfo = {
  number: bigint;
  timestamp: bigint;
};

export class SmartBlockFinder {
  private client: PublicClient;

  private averageBlockTime: number;

  private readonly TOLERANCE_SECONDS = 10;

  constructor(client: PublicClient, chainId: SupportedNetworks) {
    this.client = client;
    this.averageBlockTime = BLOCK_TIME[chainId] || 12; // default to 12 seconds if chain not found
  }

  private async getBlock(blockNumber: bigint): Promise<BlockInfo> {
    const block = await this.client.getBlock({ blockNumber });
    return {
      number: block.number,
      timestamp: block.timestamp,
    };
  }

  private isWithinTolerance(blockTimestamp: bigint, targetTimestamp: number): boolean {
    const diff = Math.abs(Number(blockTimestamp) - targetTimestamp);
    return diff <= this.TOLERANCE_SECONDS;
  }

  async findNearestBlock(targetTimestamp: number): Promise<BlockInfo> {
    // Get current block as upper bound
    const latestBlock = await this.getBlock(await this.client.getBlockNumber());
    const latestTimestamp = Number(latestBlock.timestamp);

    // If target is in the future, return latest block
    if (targetTimestamp >= latestTimestamp) {
      return latestBlock;
    }

    // Calculate initial guess based on average block time
    const timeDiff = latestTimestamp - targetTimestamp;
    const estimatedBlocksBack = Math.floor(timeDiff / this.averageBlockTime);
    const initialGuess = latestBlock.number - BigInt(estimatedBlocksBack);

    // Get initial block
    const initialBlock = await this.getBlock(initialGuess);

    // If within tolerance, return this block
    if (this.isWithinTolerance(initialBlock.timestamp, targetTimestamp)) {
      return initialBlock;
    }

    // Binary search between genesis (or 0) and latest block
    let left = 0n;
    let right = latestBlock.number;
    let closestBlock = initialBlock;
    let closestDiff = Math.abs(Number(closestBlock.timestamp) - targetTimestamp);

    while (left <= right) {
      const mid = left + (right - left) / 2n;
      const block = await this.getBlock(mid);
      const blockTimestamp = Number(block.timestamp);

      // If within tolerance, return immediately
      if (this.isWithinTolerance(block.timestamp, targetTimestamp)) {
        return block;
      }

      // Update closest block if this one is closer
      const diff = Math.abs(blockTimestamp - targetTimestamp);
      if (diff < closestDiff) {
        closestBlock = block;
        closestDiff = diff;
      }

      if (blockTimestamp > targetTimestamp) {
        right = mid - 1n;
      } else {
        left = mid + 1n;
      }
    }

    return closestBlock;
  }
}
