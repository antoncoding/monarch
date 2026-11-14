export type TimestampedBlock = {
  blockNumber: number;
  timestamp: number;
};

type FindTimestampedBlockOptions = {
  estimatedBlock: number;
  getBlockTimestamp: (blockNumber: number) => Promise<number>;
  latestBlock: number;
  latestTimestamp?: number;
  secondsPerBlockEstimate: number;
  targetTimestamp: number;
  toleranceSeconds?: number;
};

export const BLOCK_TIMESTAMP_TOLERANCE_SECONDS = 60;

const MAX_BRACKET_STEPS = 64;

/**
 * Finds a block at or shortly after a target timestamp. The initial estimate
 * keeps stable-cadence chains cheap; exponential bracketing handles cadence
 * changes before binary search narrows the remaining range.
 */
export async function findTimestampedBlock({
  estimatedBlock,
  getBlockTimestamp,
  latestBlock,
  latestTimestamp,
  secondsPerBlockEstimate,
  targetTimestamp,
  toleranceSeconds = BLOCK_TIMESTAMP_TOLERANCE_SECONDS,
}: FindTimestampedBlockOptions): Promise<TimestampedBlock> {
  const timestampCache = new Map<number, number>();
  if (latestTimestamp !== undefined) {
    timestampCache.set(latestBlock, latestTimestamp);
  }

  const readBlock = async (blockNumber: number): Promise<TimestampedBlock> => {
    const normalizedBlock = Math.max(0, Math.min(latestBlock, Math.floor(blockNumber)));
    const cachedTimestamp = timestampCache.get(normalizedBlock);
    if (cachedTimestamp !== undefined) {
      return { blockNumber: normalizedBlock, timestamp: cachedTimestamp };
    }

    const timestamp = await getBlockTimestamp(normalizedBlock);
    timestampCache.set(normalizedBlock, timestamp);
    return { blockNumber: normalizedBlock, timestamp };
  };

  const isWithinTolerance = (block: TimestampedBlock): boolean =>
    block.timestamp >= targetTimestamp && block.timestamp <= targetTimestamp + toleranceSeconds;

  const latest = await readBlock(latestBlock);
  if (targetTimestamp >= latest.timestamp) {
    return latest;
  }

  let candidate = await readBlock(estimatedBlock);
  if (isWithinTolerance(candidate)) {
    return candidate;
  }

  const safeSecondsPerBlock = Math.max(secondsPerBlockEstimate, Number.EPSILON);
  let step = Math.max(1, Math.ceil(Math.abs(candidate.timestamp - targetTimestamp) / safeSecondsPerBlock));
  let lower: TimestampedBlock | undefined;
  let upper: TimestampedBlock | undefined;

  for (let iteration = 0; iteration < MAX_BRACKET_STEPS; iteration += 1) {
    if (candidate.timestamp < targetTimestamp) {
      lower = candidate;
      const nextBlockNumber = Math.min(latestBlock, candidate.blockNumber + step);
      const next = await readBlock(nextBlockNumber);
      if (isWithinTolerance(next)) return next;
      if (next.timestamp >= targetTimestamp || next.blockNumber === latestBlock) {
        upper = next;
        break;
      }
      candidate = next;
    } else {
      upper = candidate;
      const nextBlockNumber = Math.max(0, candidate.blockNumber - step);
      const next = await readBlock(nextBlockNumber);
      if (isWithinTolerance(next)) return next;
      if (next.timestamp < targetTimestamp || next.blockNumber === 0) {
        lower = next;
        break;
      }
      candidate = next;
    }

    step *= 2;
  }

  if (!lower) {
    lower = await readBlock(0);
  }
  if (!upper) {
    upper = latest;
  }
  if (lower.timestamp >= targetTimestamp) {
    return lower;
  }

  while (upper.blockNumber - lower.blockNumber > 1) {
    const midpoint = Math.floor((lower.blockNumber + upper.blockNumber) / 2);
    const middle = await readBlock(midpoint);
    if (isWithinTolerance(middle)) {
      return middle;
    }
    if (middle.timestamp < targetTimestamp) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  return upper;
}
