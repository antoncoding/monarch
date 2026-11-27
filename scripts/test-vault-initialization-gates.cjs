'use strict';
// Run with: node --test scripts/test-vault-initialization-gates.cjs
require('tsx/cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { decodeFunctionData, erc20Abi, zeroAddress } = require('viem');
const { vaultv2Abi } = require('../src/abis/vaultv2');
const setup = require('../src/utils/vaultV2Setup');

const account = '0x1111111111111111111111111111111111111111';
const vaultAddress = '0x2222222222222222222222222222222222222222';
const asset = '0x3333333333333333333333333333333333333333';
const adapter = '0x4444444444444444444444444444444444444444';
const registry = '0x5555555555555555555555555555555555555555';
const gate = '0x6666666666666666666666666666666666666666';
const react = { useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }), useState: (v) => [v, () => {}] };

function loadHook(filename, mocks) {
  const file = path.join(__dirname, '../src/hooks', filename);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = createRequire(file);
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: mod.exports,
    module: mod,
    require: (name) => (name === 'react' ? react : (mocks[name] ?? localRequire(name))),
  });
  return mod.exports;
}

function fixture({ gates = {}, abdicated = new Set(), failedRead } = {}) {
  const sent = [];
  let allowance = 0n;
  const read = ({ address, functionName, args }) => {
    if (functionName === failedRead) throw new Error('Gate read failed');
    if (setup.VAULT_V2_EXIT_CRITICAL_GATES.some(({ getter }) => getter === functionName)) return gates[functionName] ?? zeroAddress;
    if (functionName === 'abdicated') return abdicated.has(args[0]);
    if (functionName === 'asset') return asset;
    if (functionName === 'curator') return zeroAddress;
    if (functionName === 'adapterRegistry') return registry;
    if (functionName === 'isAdapter' || functionName === 'isAllocator') return true;
    if (functionName === 'forceDeallocatePenalty') return setup.VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY;
    if (functionName === 'maxRate') return setup.VAULT_V2_DEFAULT_MAX_RATE;
    if (functionName === 'performanceFeeRecipient') return zeroAddress;
    if (functionName === 'performanceFee' || functionName === 'totalSupply' || functionName === 'totalAssets') return 0n;
    if (functionName === 'allowance') return allowance;
    if (functionName === 'balanceOf') return address === asset ? 1_000_000n : 0n;
    if (functionName === 'previewMint') return 1_000_000n;
    throw new Error(`Unexpected read: ${functionName}`);
  };
  const client = {
    getBlockNumber: async () => 100n,
    readContract: async () => 6,
    multicall: async ({ contracts, allowFailure }) =>
      contracts.map((c) => (allowFailure ? { status: 'success', result: read(c) } : read(c))),
    simulateContract: async () => ({}),
    waitForTransactionReceipt: async () => ({ status: 'success' }),
  };
  const { useVaultV2 } = loadHook('useVaultV2.ts', {
    wagmi: {
      useConnection: () => ({ address: account }),
      useChainId: () => 8453,
      usePublicClient: () => client,
      useReadContracts: () => ({ refetch: async () => {} }),
    },
    '@tanstack/react-query': { useQueryClient: () => ({}) },
    './useTransactionTracking': { useTransactionTracking: () => ({ start() {}, update() {}, complete() {}, fail() {} }) },
    './useVaultQueryRefresh': { refetchVaultQueryData: async () => {} },
    './useTransactionWithToast': {
      useTransactionWithToast: () => ({
        sendTransactionAsync: async (tx) => {
          sent.push(tx);
          if (tx.to === asset) allowance = decodeFunctionData({ abi: erc20Abi, data: tx.data }).args[1];
          return `0x${'1'.repeat(64)}`;
        },
      }),
    },
    '@/utils/morpho': {},
    '@/utils/monarch-agent': { findAgent: () => undefined },
  });
  return { sent, initialize: () => useVaultV2({ vaultAddress, chainId: 8453 }).completeInitialization(registry, adapter) };
}

test('resumed setup clears all active exit gates before minting and abdication', async () => {
  const f = fixture({ gates: Object.fromEntries(setup.VAULT_V2_EXIT_CRITICAL_GATES.map(({ getter }) => [getter, gate])) });
  assert.equal(await f.initialize(), true);
  const multicall = decodeFunctionData({ abi: vaultv2Abi, data: f.sent.at(-1).data });
  const calls = multicall.args[0].map((data) => decodeFunctionData({ abi: vaultv2Abi, data }));
  const mintIndex = calls.findIndex((c) => c.functionName === 'mint');
  assert.ok(mintIndex > 0);
  for (const [index, { setter }] of setup.VAULT_V2_EXIT_CRITICAL_GATES.entries()) {
    const resetIndex = calls.findIndex((c) => c.functionName === setter);
    assert.ok(resetIndex > 0 && resetIndex < mintIndex);
    assert.equal(calls[resetIndex].args[0], zeroAddress);
    const submitted = decodeFunctionData({ abi: vaultv2Abi, data: calls[resetIndex - 1].args[0] });
    assert.deepEqual(submitted, calls[resetIndex]);
    const abdicateIndex = calls.findIndex(
      (c) => c.functionName === 'abdicate' && c.args[0] === setup.VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS[index],
    );
    assert.ok(abdicateIndex > resetIndex);
  }
});

test('fresh setup does not add unnecessary gate resets', async () => {
  const f = fixture();
  await f.initialize();
  const calls = decodeFunctionData({ abi: vaultv2Abi, data: f.sent.at(-1).data }).args[0];
  assert.ok(
    calls.every(
      (data) =>
        !setup.VAULT_V2_EXIT_CRITICAL_GATES.some(({ setter }) => decodeFunctionData({ abi: vaultv2Abi, data }).functionName === setter),
    ),
  );
});

test('permanently configured gates and failed gate reads stop setup before approval', async () => {
  for (const [index, { getter }] of setup.VAULT_V2_EXIT_CRITICAL_GATES.entries()) {
    const f = fixture({ gates: { [getter]: gate }, abdicated: new Set([setup.VAULT_V2_EXIT_CRITICAL_GATE_SETTER_SELECTORS[index]]) });
    await assert.rejects(f.initialize(), /permanently set/);
    assert.equal(f.sent.length, 0);
    const failed = fixture({ failedRead: getter });
    await assert.rejects(failed.initialize(), /Gate read failed/);
    assert.equal(failed.sent.length, 0);
  }
});

test('setup status requires successful zero-gate reads as well as abdications', () => {
  for (const result of [zeroAddress, gate, undefined]) {
    const { useVaultV2InitializationStatus } = loadHook('useVaultV2InitializationStatus.ts', {
      wagmi: {
        useReadContracts: ({ contracts }) => ({
          data: contracts.map(({ functionName }) => {
            const value = {
              adapterRegistry: registry,
              curator: account,
              isAdapter: true,
              forceDeallocatePenalty: setup.VAULT_V2_DEFAULT_FORCE_DEALLOCATE_PENALTY,
              abdicated: true,
            }[functionName];
            return value !== undefined || result !== undefined ? { status: 'success', result: value ?? result } : { status: 'failure' };
          }),
          isLoading: false,
          refetch: async () => {},
        }),
      },
      '@/utils/networks': { getNetworkConfig: () => ({ vaultConfig: { morphoRegistry: registry } }) },
      './queries/useVaultV2DeadDepositQuery': {
        useVaultV2DeadDepositQuery: () => ({ data: { isSeeded: true }, isPending: false, isError: false }),
      },
    });
    const status = useVaultV2InitializationStatus({ vaultAddress, adapterAddress: adapter, chainId: 8453 });
    assert.equal(status.isComplete, result === zeroAddress);
  }
});
