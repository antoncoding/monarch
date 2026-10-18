import { erc20Abi, type Address, encodeFunctionData, isAddressEqual, zeroHash } from 'viem';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import type { Market } from '@/utils/types';
import { type Bundler3Call, getParaswapSellOffsets } from './bundler3';
import type { SwapLeverageRoute } from './types';
import type { PendlePtSwapQuote } from './pendle-types';
import { assertExecutablePendleQuote } from './pendle-validation';
import { assertTrustedVeloraExecutionTarget, buildVeloraBundlerTransactionPayload } from './velora-transaction';

type BuildPendleCallsParams = {
  bundlerAddress: Address;
  direction: PendlePtSwapQuote['direction'];
  expectedAmountIn: bigint;
  market: Market;
  quote: PendlePtSwapQuote;
  route: SwapLeverageRoute;
  slippageBps: number;
};

const call = (to: Address, data: `0x${string}`): Bundler3Call => ({
  to,
  data,
  value: 0n,
  skipRevert: false,
  callbackHash: zeroHash,
});

const buildPendleRouterCalls = ({
  bundlerAddress,
  inputToken,
  quote,
  route,
}: Pick<BuildPendleCallsParams, 'bundlerAddress' | 'quote' | 'route'> & { inputToken: Address }): Bundler3Call[] => [
  call(
    route.generalAdapterAddress,
    encodeFunctionData({
      abi: morphoGeneralAdapterV1Abi,
      functionName: 'erc20Transfer',
      args: [inputToken, bundlerAddress, quote.pendle.exactInputAmount],
    }),
  ),
  call(
    inputToken,
    encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [quote.pendle.router, quote.pendle.exactInputAmount] }),
  ),
  call(quote.pendle.router, quote.pendle.data),
];

const buildVeloraCalls = async ({
  destinationDecimals,
  destinationToken,
  market,
  quote,
  route,
  slippageBps,
  sourceDecimals,
  sourceSymbol,
  sourceToken,
}: Omit<BuildPendleCallsParams, 'bundlerAddress' | 'direction' | 'expectedAmountIn'> & {
  destinationDecimals: number;
  destinationToken: Address;
  sourceDecimals: number;
  sourceSymbol: string;
  sourceToken: Address;
}): Promise<Bundler3Call[]> => {
  const external = quote.externalSwap;
  if (!external) return [];

  const error = `Pendle ${quote.direction} quote changed. Please review the updated preview and try again.`;
  const payload = await buildVeloraBundlerTransactionPayload({
    destinationTokenAddress: destinationToken,
    destinationTokenDecimals: destinationDecimals,
    executionAddress: route.paraswapAdapterAddress,
    network: market.morphoBlue.chain.id,
    priceRoute: external.priceRoute,
    quoteChangedMessage: error,
    slippageBps,
    sourceTokenAddress: sourceToken,
    sourceTokenAmount: external.inputAmount,
    sourceTokenDecimals: sourceDecimals,
    sourceTokenSymbol: sourceSymbol,
  });
  assertTrustedVeloraExecutionTarget({ priceRoute: external.priceRoute, quoteChangedMessage: error, transactionTarget: payload.to });
  if (payload.value && BigInt(payload.value) !== 0n) throw new Error(`Pendle ${quote.direction} does not support native-value swaps.`);

  const offsets = getParaswapSellOffsets({
    augustusCallData: payload.data,
    exactAmount: external.inputAmount,
    limitAmount: external.minOutputAmount,
  });
  return [
    call(
      route.generalAdapterAddress,
      encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'erc20Transfer',
        args: [sourceToken, route.paraswapAdapterAddress, external.inputAmount],
      }),
    ),
    call(
      route.paraswapAdapterAddress,
      encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: 'sell',
        args: [payload.to, payload.data, sourceToken, destinationToken, false, offsets, route.generalAdapterAddress],
      }),
    ),
  ];
};

// Same two-leg shape as the reference Yieldz bundle: the DEX only bridges
// loan <-> SY input; PT mint/sell always goes through the verified Pendle router.
export const buildPendleConversionCalls = async (params: BuildPendleCallsParams): Promise<Bundler3Call[]> => {
  const { bundlerAddress, direction, expectedAmountIn, market, quote, route, slippageBps } = params;
  assertExecutablePendleQuote({
    direction,
    expectedAmountIn,
    expectedLoanToken: market.loanAsset.address as Address,
    expectedPt: market.collateralAsset.address as Address,
    expectedReceiver: route.generalAdapterAddress,
    expectedSlippageBps: slippageBps,
    quote,
  });

  if (!quote.externalSwap && !isAddressEqual(quote.metadata.underlyingToken, market.loanAsset.address as Address)) {
    throw new Error(`Pendle ${direction} route is missing its required external swap.`);
  }

  const routerCalls = buildPendleRouterCalls({
    bundlerAddress,
    inputToken: direction === 'leverage' ? quote.metadata.underlyingToken : (market.collateralAsset.address as Address),
    quote,
    route,
  });
  const veloraCalls = await buildVeloraCalls({
    destinationDecimals: direction === 'leverage' ? quote.metadata.underlyingDecimals : market.loanAsset.decimals,
    destinationToken: direction === 'leverage' ? quote.metadata.underlyingToken : (market.loanAsset.address as Address),
    market,
    quote,
    route,
    slippageBps,
    sourceDecimals: direction === 'leverage' ? market.loanAsset.decimals : quote.metadata.underlyingDecimals,
    sourceSymbol: direction === 'leverage' ? market.loanAsset.symbol : 'Pendle underlying',
    sourceToken: direction === 'leverage' ? (market.loanAsset.address as Address) : quote.metadata.underlyingToken,
  });

  return direction === 'leverage' ? [...veloraCalls, ...routerCalls] : [...routerCalls, ...veloraCalls];
};

export const getPendleSweepTokens = (market: Market, ...quotes: PendlePtSwapQuote[]): Address[] =>
  [
    market.loanAsset.address as Address,
    market.collateralAsset.address as Address,
    ...quotes.flatMap((quote) => [quote.metadata.underlyingToken, quote.metadata.sy, quote.metadata.yt]),
  ].filter((token, index, tokens) => tokens.findIndex((candidate) => isAddressEqual(candidate, token)) === index);
