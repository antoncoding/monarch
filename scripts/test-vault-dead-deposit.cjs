'use strict';
// Run with: node --test scripts/test-vault-dead-deposit.cjs
require('tsx/cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { decodeFunctionData, maxUint256 } = require('viem');
const { vaultv2Abi } = require('../src/abis/vaultv2');
const { getVaultV2DeadDepositAmounts, VAULT_V2_DEAD_DEPOSIT_RECEIVER } = require('../src/utils/vaultV2Setup');
const { fetchVaultV2DeadDeposit } = require('../src/data-sources/rpc/vault-dead-deposit');
const { prepareVaultV2DeadDeposit } = require('../src/hooks/vault-dead-deposit');

const vaultAddress = '0x1111111111111111111111111111111111111111';
const account = '0x2222222222222222222222222222222222222222';
const asset = '0x3333333333333333333333333333333333333333';

function fixture(overrides = {}) {
  const state = {
    decimals: 6,
    totalSupply: 0n,
    totalAssets: 0n,
    deadShares: 0n,
    allowance: 0n,
    balance: 1_000_000n,
    previewAssets: 1_000_000n,
    ...overrides,
  };
  const approvals = [];
  const reads = [];
  let block = 100n;
  const client = {
    getBlockNumber: async (options) => {
      assert.equal(options.cacheTime, 0);
      return ++block;
    },
    multicall: async ({ contracts, allowFailure, blockNumber }) => {
      assert.equal(allowFailure, false);
      reads.push({ contracts, blockNumber });
      return contracts.map((contract) => {
        const { functionName, address, args } = contract;
        if (functionName === 'asset') return asset;
        if (functionName === 'totalSupply') return state.totalSupply;
        if (functionName === 'totalAssets') return state.totalAssets;
        if (functionName === 'balanceOf') {
          if (address === vaultAddress) {
            assert.equal(args[0], VAULT_V2_DEAD_DEPOSIT_RECEIVER);
            return state.deadShares;
          }
          assert.equal(address, asset);
          assert.equal(args[0], account);
          return state.balance;
        }
        if (functionName === 'allowance') {
          assert.equal(address, asset);
          assert.deepEqual(args, [account, vaultAddress]);
          return state.allowance;
        }
        if (functionName === 'previewMint') {
          assert.equal(address, vaultAddress);
          return state.previewAssets;
        }
        throw new Error(`Unexpected contract read: ${functionName}`);
      });
    },
    readContract: async ({ address, functionName, blockNumber }) => {
      assert.equal(address, asset);
      assert.equal(functionName, 'decimals');
      assert.equal(blockNumber, block);
      return state.decimals;
    },
  };
  const approve = async (token, amount) => {
    assert.equal(token, asset);
    approvals.push(amount);
    state.allowance = amount;
  };
  const prepare = (overrideApprove = approve) => prepareVaultV2DeadDeposit({ client, vaultAddress, account, approve: overrideApprove });
  return { state, client, approvals, reads, approve, prepare };
}

test('Morpho seed amounts use underlying decimals, including the share-floor boundary', () => {
  for (const [decimals, shares, assets] of [
    [0, 10n ** 24n, 1_000_000n],
    [6, 10n ** 18n, 1_000_000n],
    [8, 10n ** 16n, 1_000_000n],
    [14, 10n ** 10n, 1_000_000n],
    [15, 1_000_000_000n, 1_000_000n],
    [16, 1_000_000_000n, 10_000_000n],
    [18, 1_000_000_000n, 1_000_000_000n],
    [24, 1_000_000_000n, 1_000_000_000n],
    [255, 1_000_000_000n, 1_000_000_000n],
  ])
    assert.deepEqual(getVaultV2DeadDepositAmounts(decimals), { shares, assets });
  for (const decimals of [-1, 1.5, 256, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => getVaultV2DeadDepositAmounts(decimals), /Invalid underlying token decimals/);
  }
});

test('eligibility reads use one fresh block and fail closed on RPC errors', async () => {
  const f = fixture();
  assert.equal((await fetchVaultV2DeadDeposit(f.client, vaultAddress)).isSeeded, false);
  assert.equal(f.reads[0].blockNumber, 101n);
  f.client.readContract = async () => {
    throw new Error('RPC unavailable');
  };
  await assert.rejects(f.prepare(), /RPC unavailable/);
  assert.deepEqual(f.approvals, []);
});

test('empty vault approves only the seed and encodes mint to the dead address', async () => {
  const f = fixture();
  const calls = await f.prepare();
  assert.deepEqual(f.approvals, [1_000_000n]);
  assert.equal(calls.length, 1);
  assert.deepEqual(decodeFunctionData({ abi: vaultv2Abi, data: calls[0] }), {
    functionName: 'mint',
    args: [10n ** 18n, VAULT_V2_DEAD_DEPOSIT_RECEIVER],
  });
});

test('8- and 18-decimal assets mint the correct raw shares and spend', async () => {
  for (const [decimals, expectedShares, expectedAssets] of [
    [8, 10n ** 16n, 1_000_000n],
    [18, 1_000_000_000n, 1_000_000_000n],
  ]) {
    const f = fixture({ decimals, balance: expectedAssets, previewAssets: expectedAssets });
    const [data] = await f.prepare();
    assert.deepEqual(f.approvals, [expectedAssets]);
    assert.equal(decodeFunctionData({ abi: vaultv2Abi, data }).args[0], expectedShares);
  }
});

test('existing sufficient dead shares skip mint and approval on resumed setup', async () => {
  const f = fixture({ totalSupply: 2n * 10n ** 18n, deadShares: 10n ** 18n, totalAssets: 2_000_000n });
  assert.deepEqual(await f.prepare(), []);
  assert.deepEqual(f.approvals, []);
});

test('funded vaults, insufficient dead shares, and residual assets cannot be seeded automatically', async () => {
  for (const state of [{ totalSupply: 1n }, { totalSupply: 10n ** 18n, deadShares: 10n ** 18n - 1n }, { totalAssets: 1n }]) {
    const f = fixture(state);
    await assert.rejects(f.prepare(), /already has deposits/);
    assert.deepEqual(f.approvals, []);
  }
});

test('insufficient wallet funds and unexpected seed prices stop before approval', async () => {
  for (const state of [{ balance: 999_999n }, { previewAssets: 1_000_001n }, { previewAssets: 999_999n }]) {
    const f = fixture(state);
    await assert.rejects(f.prepare(), /Insufficient token balance|initial share price has changed/);
    assert.deepEqual(f.approvals, []);
  }
});

test('both excessive and insufficient prior allowances reset to zero before exact approval', async () => {
  for (const allowance of [maxUint256, 999_999n, 1_000_001n]) {
    const f = fixture({ allowance });
    await f.prepare();
    assert.deepEqual(f.approvals, [0n, 1_000_000n]);
  }
  const exact = fixture({ allowance: 1_000_000n });
  await exact.prepare();
  assert.deepEqual(exact.approvals, []);
});

test('rejected or reverted approval cannot produce a mint call', async () => {
  const f = fixture();
  await assert.rejects(
    f.prepare(async () => {
      throw new Error('Approval reverted');
    }),
    /Approval reverted/,
  );
});

test('preparation waits for approval confirmation before rechecking vault state', async () => {
  const f = fixture();
  let confirm;
  const confirmation = new Promise((resolve) => {
    confirm = resolve;
  });
  let approvalStarted;
  const started = new Promise((resolve) => {
    approvalStarted = resolve;
  });
  const pending = f.prepare(async (token, amount) => {
    approvalStarted();
    await confirmation;
    await f.approve(token, amount);
  });
  await started;
  assert.equal(f.reads.length, 2);
  confirm();
  await pending;
  assert.equal(f.reads[2].blockNumber, 102n);
});

test('a deposit during approval blocks setup instead of seeding an already-used vault', async () => {
  const f = fixture();
  await assert.rejects(
    f.prepare(async (token, amount) => {
      await f.approve(token, amount);
      f.state.totalSupply = 1n;
    }),
    /already has deposits/,
  );
});

test('a completed seed during approval is not minted again', async () => {
  const f = fixture();
  const calls = await f.prepare(async (token, amount) => {
    await f.approve(token, amount);
    f.state.totalSupply = 10n ** 18n;
    f.state.deadShares = 10n ** 18n;
  });
  assert.deepEqual(calls, []);
});

test('wallet-edited approval limits and changed prices after approval are rejected', async () => {
  const f = fixture();
  await assert.rejects(
    f.prepare(async () => {
      f.state.allowance = maxUint256;
    }),
    /Approve exactly/,
  );
  const changed = fixture();
  await assert.rejects(
    changed.prepare(async (token, amount) => {
      await changed.approve(token, amount);
      changed.state.previewAssets = 1_000_001n;
    }),
    /initial share price has changed/,
  );
});
