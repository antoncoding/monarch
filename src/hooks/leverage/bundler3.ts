import { type Address, encodeAbiParameters } from 'viem';

const PARASWAP_SWAP_EXACT_AMOUNT_IN_SELECTOR = '0xe3ead59e';
const PARASWAP_SELL_EXACT_AMOUNT_OFFSET = 100n;
const PARASWAP_SELL_MIN_DEST_AMOUNT_OFFSET = 132n;
const PARASWAP_SELL_QUOTED_DEST_AMOUNT_OFFSET = 164n;

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

export const getParaswapSellOffsets = (augustusCallData: `0x${string}`) => {
  const selector = augustusCallData.slice(0, 10).toLowerCase();
  if (selector !== PARASWAP_SWAP_EXACT_AMOUNT_IN_SELECTOR) {
    throw new Error('Unsupported Velora swap method for Paraswap adapter route.');
  }

  return {
    exactAmount: PARASWAP_SELL_EXACT_AMOUNT_OFFSET,
    limitAmount: PARASWAP_SELL_MIN_DEST_AMOUNT_OFFSET,
    quotedAmount: PARASWAP_SELL_QUOTED_DEST_AMOUNT_OFFSET,
  } as const;
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
