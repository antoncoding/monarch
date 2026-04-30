import { type Abi, type Address, encodeAbiParameters, encodeFunctionData, maxUint256, zeroHash } from 'viem';

const CALLDATA_SELECTOR_BYTES = 4n;
const WORD_BYTES = 32n;

export type Bundler3Call = {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  skipRevert: boolean;
  callbackHash: `0x${string}`;
};

const BUNDLER3_CALLS_ABI_PARAMS = [
  {
    type: 'tuple[]',
    components: [
      { type: 'address', name: 'to' },
      { type: 'bytes', name: 'data' },
      { type: 'uint256', name: 'value' },
      { type: 'bool', name: 'skipRevert' },
      { type: 'bytes32', name: 'callbackHash' },
    ],
  },
] as const;

export const encodeBundler3Calls = (bundle: Bundler3Call[]): `0x${string}` => {
  return encodeAbiParameters(BUNDLER3_CALLS_ABI_PARAMS, [bundle]);
};

export const getParaswapSellOffsets = ({
  augustusCallData,
  exactAmount,
  limitAmount,
}: {
  augustusCallData: `0x${string}`;
  exactAmount: bigint;
  limitAmount: bigint;
}) => {
  // Guard only for malformed calldata; supported Velora/Paraswap sell methods can vary by selector
  // while retaining adjacent exact-in amount fields required by the adapter offsets below.
  if (augustusCallData.length < 10) {
    throw new Error('Invalid Paraswap calldata for swap-backed route.');
  }

  const calldataByteLength = BigInt((augustusCallData.length - 2) / 2);
  for (let offset = CALLDATA_SELECTOR_BYTES; offset + WORD_BYTES * 3n <= calldataByteLength; offset += WORD_BYTES) {
    const candidateExactAmount = readCalldataUint256(augustusCallData, offset);
    if (candidateExactAmount !== exactAmount) continue;

    const candidateLimitAmount = readCalldataUint256(augustusCallData, offset + WORD_BYTES);
    if (candidateLimitAmount !== limitAmount) continue;

    return {
      exactAmount: offset,
      limitAmount: offset + WORD_BYTES,
      quotedAmount: offset + WORD_BYTES * 2n,
    } as const;
  }

  throw new Error('Paraswap sell calldata does not match the reviewed swap quote.');
};

export const readCalldataUint256 = (callData: `0x${string}`, offset: bigint): bigint => {
  const byteOffset = Number(offset);
  const start = 2 + byteOffset * 2;
  const end = start + 64;
  if (callData.length < end) {
    throw new Error('Invalid Paraswap calldata for swap-backed route.');
  }

  return BigInt(`0x${callData.slice(start, end)}`);
};

type Bundler3SweepTarget = {
  adapterAbi: Abi;
  adapterAddress: Address;
};

/**
 * Explicitly sweep every touched adapter/token pair after execution.
 * This keeps residual dust from remaining in Bundler3 adapters after flash-loan settlement.
 */
export const buildBundler3Erc20SweepCalls = ({
  recipient,
  sweepTargets,
  tokenAddresses,
}: {
  recipient: Address;
  sweepTargets: Bundler3SweepTarget[];
  tokenAddresses: Address[];
}): Bundler3Call[] => {
  const sweepCalls: Bundler3Call[] = [];

  for (const { adapterAbi, adapterAddress } of sweepTargets) {
    for (const tokenAddress of tokenAddresses) {
      sweepCalls.push({
        to: adapterAddress,
        data: encodeFunctionData({
          abi: adapterAbi,
          functionName: 'erc20Transfer',
          args: [tokenAddress, recipient, maxUint256],
        }),
        value: 0n,
        skipRevert: false,
        callbackHash: zeroHash,
      });
    }
  }

  return sweepCalls;
};
