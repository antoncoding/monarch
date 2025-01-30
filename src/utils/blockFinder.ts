import { type PublicClient } from 'viem';
import { SupportedNetworks } from './networks';
import { BLOCK_TIME, LATEST_BLOCK_DELAY } from './rpc';

type BlockInfo = {
  number: bigint;
  timestamp: bigint;
};

export class SmartBlockFinder {
  private client: PublicClient;

  private averageBlockTime: number;

  private latestBlockDelay: number;

  private readonly TOLERANCE_SECONDS = 10;

  constructor(client: PublicClient, chainId: SupportedNetworks) {
    this.client = client;
    this.averageBlockTime = BLOCK_TIME[chainId] || 12;
    this.latestBlockDelay = LATEST_BLOCK_DELAY[chainId] || 0;
  }

  private async getBlock(blockNumber: bigint): Promise<BlockInfo> {
    try {
      const block = await this.client.getBlock({ blockNumber });
      return {
        number: block.number,
        timestamp: block.timestamp,
      };
    } catch (error) {
      // await 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const block = await this.client.getBlock({ blockNumber: blockNumber - 1n });
      return {
        number: block.number,
        timestamp: block.timestamp,
      };
    }
  }

  private isWithinTolerance(blockTimestamp: bigint, targetTimestamp: number): boolean {
    const diff = Math.abs(Number(blockTimestamp) - targetTimestamp);
    return diff <= this.TOLERANCE_SECONDS;
  }

  async findNearestBlock(targetTimestamp: number): Promise<BlockInfo> {
    // Get current block as upper bound, buffer with 3 blocks

    const lastestBlockNumber = (await this.client.getBlockNumber()) - BigInt(this.latestBlockDelay);
    const latestBlock = await this.getBlock(lastestBlockNumber);

    const latestTimestamp = Number(latestBlock.timestamp);

    // If target is in the future, return latest block
    if (targetTimestamp >= latestTimestamp) {
      return latestBlock;
    }

    // Calculate initial guess based on average block time
    const timeDiff = latestTimestamp - targetTimestamp;
    const estimatedBlocksBack = Math.max(Math.floor(timeDiff / this.averageBlockTime), 0);

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

      if (mid > latestBlock.number) {
        console.log('errorr  .....');
      }

      const toQuery = mid > latestBlock.number ? latestBlock.number : mid;
      const block = await this.getBlock(toQuery);
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
