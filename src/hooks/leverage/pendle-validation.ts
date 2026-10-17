import { type Address, decodeFunctionData, isAddressEqual, zeroAddress } from 'viem';
import { pendleRouterAbi } from '@/abis/pendle';
import { withSlippageFloor } from './math';
import { PENDLE_LIMIT_ROUTER_ADDRESS, PENDLE_ROUTER_ADDRESS } from './pendle-config';
import type { PendlePtMetadata, PendlePtSwapQuote } from './pendle-types';

const NO_AGGREGATOR = 0;

const assertNoNestedAggregator = ({
  extCalldata,
  extRouter,
  needScale,
  pendleSwap,
  swapType,
}: {
  extCalldata: `0x${string}`;
  extRouter: Address;
  needScale: boolean;
  pendleSwap: Address;
  swapType: number;
}) => {
  if (
    !isAddressEqual(pendleSwap, zeroAddress) ||
    swapType !== NO_AGGREGATOR ||
    !isAddressEqual(extRouter, zeroAddress) ||
    extCalldata !== '0x' ||
    needScale
  ) {
    throw new Error('Pendle route unexpectedly contains a nested aggregator.');
  }
};

const assertLimitOrders = ({
  direction,
  flashFills,
  limitRouter,
  metadata,
  normalFills,
}: {
  direction: 'buy' | 'sell';
  flashFills: readonly { order: { orderType: number; token: Address; YT: Address } }[];
  limitRouter: Address;
  metadata: PendlePtMetadata;
  normalFills: readonly { order: { orderType: number; token: Address; YT: Address } }[];
}) => {
  if (!isAddressEqual(limitRouter, zeroAddress) && !isAddressEqual(limitRouter, PENDLE_LIMIT_ROUTER_ADDRESS)) {
    throw new Error('Pendle route uses an untrusted limit router.');
  }
  if (normalFills.length + flashFills.length > 64) throw new Error('Pendle route contains too many limit-order fills.');

  for (const fill of [...normalFills, ...flashFills]) {
    const trustedToken = isAddressEqual(fill.order.token, metadata.underlyingToken) || isAddressEqual(fill.order.token, metadata.sy);
    if (!isAddressEqual(fill.order.YT, metadata.yt) || !trustedToken) {
      throw new Error('Pendle limit order does not match the reviewed PT market.');
    }
  }

  const normalType = direction === 'buy' ? 1 : 0;
  const flashType = direction === 'buy' ? 2 : 3;
  if (normalFills.some((fill) => fill.order.orderType !== normalType) || flashFills.some((fill) => fill.order.orderType !== flashType)) {
    throw new Error('Pendle limit order type does not match the requested PT direction.');
  }
};

type CalldataValidationParams = {
  amount: bigint;
  data: `0x${string}`;
  metadata: PendlePtMetadata;
  quotedOutputAmount: bigint;
  receiver: Address;
  slippageBps: number;
};

const assertOutputBounds = (actualInput: bigint, expectedInput: bigint, minOutput: bigint, quotedOutput: bigint, slippageBps: number) => {
  const localFloor = withSlippageFloor(quotedOutput, slippageBps);
  if (actualInput !== expectedInput || minOutput < localFloor || minOutput > quotedOutput) {
    throw new Error('Pendle amounts do not match the reviewed quote.');
  }
};

export const validatePendleBuyCalldata = ({
  amount,
  data,
  metadata,
  quotedOutputAmount,
  receiver,
  slippageBps,
}: CalldataValidationParams) => {
  const decoded = decodeFunctionData({ abi: pendleRouterAbi, data });
  if (decoded.functionName !== 'swapExactTokenForPt') throw new Error('Pendle PT buy calldata is not swapExactTokenForPt.');
  const [decodedReceiver, market, minPtOut, approximation, input, limit] = decoded.args;
  if (!isAddressEqual(decodedReceiver, receiver)) throw new Error('Pendle PT buy receiver does not match the Morpho adapter.');
  if (!isAddressEqual(input.tokenIn, metadata.underlyingToken) || !isAddressEqual(input.tokenMintSy, metadata.underlyingToken)) {
    throw new Error('Pendle PT buy uses an unexpected input token.');
  }
  assertOutputBounds(input.netTokenIn, amount, minPtOut, quotedOutputAmount, slippageBps);
  assertNoNestedAggregator({ pendleSwap: input.pendleSwap, ...input.swapData });
  if (approximation.maxIteration <= 0n || approximation.maxIteration > 256n) {
    throw new Error('Pendle PT buy uses an unsafe approximation bound.');
  }
  assertLimitOrders({ ...limit, direction: 'buy', metadata });
  return { market, minOutputAmount: minPtOut };
};

export const validatePendleSellCalldata = ({
  amount,
  data,
  metadata,
  quotedOutputAmount,
  receiver,
  slippageBps,
}: CalldataValidationParams) => {
  const decoded = decodeFunctionData({ abi: pendleRouterAbi, data });
  if (decoded.functionName !== 'swapExactPtForToken') throw new Error('Pendle PT sell calldata is not swapExactPtForToken.');
  const [decodedReceiver, market, exactPtIn, output, limit] = decoded.args;
  if (!isAddressEqual(decodedReceiver, receiver)) throw new Error('Pendle PT sell receiver does not match the Morpho adapter.');
  if (!isAddressEqual(output.tokenOut, metadata.underlyingToken) || !isAddressEqual(output.tokenRedeemSy, metadata.underlyingToken)) {
    throw new Error('Pendle PT sell uses an unexpected output token.');
  }
  assertOutputBounds(exactPtIn, amount, output.minTokenOut, quotedOutputAmount, slippageBps);
  assertNoNestedAggregator({ pendleSwap: output.pendleSwap, ...output.swapData });
  assertLimitOrders({ ...limit, direction: 'sell', metadata });
  return { market, minOutputAmount: output.minTokenOut };
};

export const validatePendleRedeemCalldata = ({
  amount,
  data,
  metadata,
  quotedOutputAmount,
  receiver,
  slippageBps,
}: CalldataValidationParams) => {
  const decoded = decodeFunctionData({ abi: pendleRouterAbi, data });
  if (decoded.functionName !== 'redeemPyToToken') throw new Error('Pendle expired PT calldata is not redeemPyToToken.');
  const [decodedReceiver, yt, netPyIn, output] = decoded.args;
  if (!isAddressEqual(decodedReceiver, receiver)) throw new Error('Pendle expired PT receiver does not match the Morpho adapter.');
  if (!isAddressEqual(yt, metadata.yt)) throw new Error('Pendle expired PT route uses an unexpected YT.');
  if (!isAddressEqual(output.tokenOut, metadata.underlyingToken) || !isAddressEqual(output.tokenRedeemSy, metadata.underlyingToken)) {
    throw new Error('Pendle expired PT route uses an unexpected output token.');
  }
  assertOutputBounds(netPyIn, amount, output.minTokenOut, quotedOutputAmount, slippageBps);
  assertNoNestedAggregator({ pendleSwap: output.pendleSwap, ...output.swapData });
  return { minOutputAmount: output.minTokenOut };
};

// Re-decode at submission time. Quote objects are cached UI state; calldata is the
// authoritative execution contract and must still match the current form inputs.
export const assertExecutablePendleQuote = ({
  direction,
  expectedAmountIn,
  expectedLoanToken,
  expectedPt,
  expectedReceiver,
  expectedSlippageBps,
  quote,
}: {
  direction: PendlePtSwapQuote['direction'];
  expectedAmountIn: bigint;
  expectedLoanToken: Address;
  expectedPt: Address;
  expectedReceiver: Address;
  expectedSlippageBps: number;
  quote: PendlePtSwapQuote;
}) => {
  if (quote.direction !== direction || BigInt(quote.srcAmount) !== expectedAmountIn) {
    throw new Error('Pendle quote no longer matches the requested transaction.');
  }
  const source = direction === 'leverage' ? expectedLoanToken : expectedPt;
  const destination = direction === 'leverage' ? expectedPt : expectedLoanToken;
  if (!isAddressEqual(quote.srcToken, source) || !isAddressEqual(quote.destToken, destination)) {
    throw new Error('Pendle quote token pair does not match this market.');
  }
  if (!isAddressEqual(quote.pendle.router, PENDLE_ROUTER_ADDRESS) || !isAddressEqual(quote.metadata.pt, expectedPt)) {
    throw new Error('Pendle quote contains an unsupported execution target.');
  }
  if (quote.slippageBps !== expectedSlippageBps) throw new Error('Pendle quote slippage no longer matches the transaction.');

  const validationParams = {
    amount: quote.pendle.exactInputAmount,
    data: quote.pendle.data,
    metadata: quote.metadata,
    quotedOutputAmount: quote.pendle.quotedOutputAmount,
    receiver: expectedReceiver,
    slippageBps: expectedSlippageBps,
  };
  const validation =
    direction === 'leverage'
      ? validatePendleBuyCalldata(validationParams)
      : quote.pendle.executionKind === 'market-swap'
        ? validatePendleSellCalldata(validationParams)
        : { market: null, ...validatePendleRedeemCalldata(validationParams) };
  if (
    (validation.market == null) !== (quote.pendle.market == null) ||
    (validation.market != null && quote.pendle.market != null && !isAddressEqual(validation.market, quote.pendle.market)) ||
    validation.minOutputAmount !== quote.pendle.minOutputAmount
  ) {
    throw new Error('Pendle calldata no longer matches the reviewed quote.');
  }

  const pendleInput = direction === 'leverage' ? (quote.externalSwap?.minOutputAmount ?? expectedAmountIn) : expectedAmountIn;
  if (quote.pendle.exactInputAmount !== pendleInput) throw new Error('Pendle leg input does not match the source route.');
  if (quote.externalSwap) {
    const externalInput = direction === 'leverage' ? expectedAmountIn : quote.pendle.minOutputAmount;
    if (quote.externalSwap.inputAmount !== externalInput) throw new Error('External swap input does not match the Pendle route.');
  } else if (!isAddressEqual(quote.metadata.underlyingToken, expectedLoanToken)) {
    throw new Error('Pendle route requires an external swap that is missing.');
  }

  const quotedDestination =
    direction === 'leverage'
      ? quote.pendle.quotedOutputAmount
      : (quote.externalSwap?.quotedOutputAmount ?? quote.pendle.quotedOutputAmount);
  const minimumDestination =
    direction === 'leverage' ? quote.pendle.minOutputAmount : (quote.externalSwap?.minOutputAmount ?? quote.pendle.minOutputAmount);
  if (BigInt(quote.destAmount) !== quotedDestination || BigInt(quote.minDestAmount) !== minimumDestination) {
    throw new Error('Pendle route outputs do not match the reviewed legs.');
  }
};
