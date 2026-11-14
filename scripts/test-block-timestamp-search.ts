import assert from 'node:assert/strict';
import test from 'node:test';
import { findTimestampedBlock } from '../src/utils/block-timestamp-search';

test('finds a target across a historical block-cadence change without scanning linearly', async () => {
  let reads = 0;
  const timestampForBlock = (blockNumber: number) =>
    blockNumber <= 1_000 ? blockNumber * 2 : 2_000 + Math.floor((blockNumber - 1_000) / 5);
  const latestBlock = 6_000;
  const latestTimestamp = timestampForBlock(latestBlock);
  const targetTimestamp = 1_500;
  const estimatedBlock = latestBlock - Math.floor((latestTimestamp - targetTimestamp) / 2);

  const result = await findTimestampedBlock({
    estimatedBlock,
    getBlockTimestamp: async (blockNumber) => {
      reads += 1;
      return timestampForBlock(blockNumber);
    },
    latestBlock,
    latestTimestamp,
    secondsPerBlockEstimate: 2,
    targetTimestamp,
  });

  assert.ok(result.timestamp >= targetTimestamp);
  assert.ok(result.timestamp <= targetTimestamp + 60);
  assert.ok(reads < 25, `expected fewer than 25 reads, received ${reads}`);
});

test('keeps an accurate initial estimate cheap', async () => {
  let reads = 0;
  const result = await findTimestampedBlock({
    estimatedBlock: 500,
    getBlockTimestamp: async (blockNumber) => {
      reads += 1;
      return blockNumber * 2;
    },
    latestBlock: 1_000,
    latestTimestamp: 2_000,
    secondsPerBlockEstimate: 2,
    targetTimestamp: 1_000,
  });

  assert.equal(result.blockNumber, 500);
  assert.equal(result.timestamp, 1_000);
  assert.equal(reads, 1);
});

test('returns the latest block for a target newer than the available chain head', async () => {
  let reads = 0;
  const result = await findTimestampedBlock({
    estimatedBlock: 1_000,
    getBlockTimestamp: async (blockNumber) => {
      reads += 1;
      return blockNumber * 2;
    },
    latestBlock: 1_000,
    latestTimestamp: 2_000,
    secondsPerBlockEstimate: 2,
    targetTimestamp: 2_010,
  });

  assert.deepEqual(result, { blockNumber: 1_000, timestamp: 2_000 });
  assert.equal(reads, 0);
});
