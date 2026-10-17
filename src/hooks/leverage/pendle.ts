import { erc20Abi, type Address, getAddress, isAddress, isAddressEqual, isHex, type PublicClient, zeroAddress } from 'viem';
import { z } from 'zod';
import {
  pendleMarketAbi,
  pendleMarketFactoryAbi,
  pendlePtAbi,
  pendleSyAbi,
  pendleYieldContractFactoryAbi,
  pendleYtAbi,
} from '@/abis/pendle';
import { fetchVeloraPriceRoute } from '@/features/swap/api/velora';
import { MAX_SLIPPAGE_BPS } from '@/features/swap/constants';
import { withSlippageFloor } from './math';
import {
  isTrustedPendleMarketFactory,
  isTrustedPendleYieldContractFactory,
  PENDLE_API_BASE_URL,
  PENDLE_ROUTER_ADDRESS,
} from './pendle-config';
import type { ExecutableSwapQuote, PendleLeg, PendlePtLeveragePlan, PendlePtMetadata, PendlePtSwapQuote } from './pendle-types';
import { validatePendleBuyCalldata, validatePendleRedeemCalldata, validatePendleSellCalldata } from './pendle-validation';
import { LEVERAGE_SWAP_EXCLUDED_DEXS } from './swap-route-policy';

export type { ExecutableSwapQuote, PendleLeg, PendlePtLeveragePlan, PendlePtMetadata, PendlePtSwapQuote } from './pendle-types';

const MAX_PENDLE_CALLDATA_HEX_LENGTH = 262_146;
const TARGET_BUFFER_BPS = 10_020n;
const BPS = 10_000n;
const MAX_SIZE_ATTEMPTS = 4;

const hasAddress = (addresses: readonly Address[], address: Address): boolean =>
  addresses.some((candidate) => isAddressEqual(candidate, address));

const PendleOutputSchema = z.object({
  token: z.string(),
  amount: z.string().regex(/^\d+$/),
});

const PendleRouteSchema = z.object({
  outputs: z.array(PendleOutputSchema),
  tx: z.object({
    to: z.string(),
    data: z.string(),
    value: z.union([z.string(), z.number(), z.null()]).optional(),
  }),
});

const PendleConvertResponseSchema = z.object({
  action: z.string(),
  routes: z.array(PendleRouteSchema),
});

export const isPendlePtSwapQuote = (quote: ExecutableSwapQuote): quote is PendlePtSwapQuote => {
  return 'kind' in quote && quote.kind === 'pendle-pt';
};

export const isPendlePtLeveragePlan = (quote: ExecutableSwapQuote): quote is PendlePtLeveragePlan => {
  return 'kind' in quote && quote.kind === 'pendle-pt-leverage';
};

export const createPendlePtLeveragePlan = (initialCapital: PendlePtSwapQuote | null, flash: PendlePtSwapQuote): PendlePtLeveragePlan => {
  if (flash.direction !== 'leverage' || (initialCapital && initialCapital.direction !== 'leverage')) {
    throw new Error('Pendle leverage plan contains an invalid route direction.');
  }
  if (
    initialCapital &&
    (!isAddressEqual(initialCapital.srcToken, flash.srcToken) || !isAddressEqual(initialCapital.destToken, flash.destToken))
  ) {
    throw new Error('Pendle leverage legs use different token pairs.');
  }

  const srcAmount = BigInt(initialCapital?.srcAmount ?? 0n) + BigInt(flash.srcAmount);
  const destAmount = BigInt(initialCapital?.destAmount ?? 0n) + BigInt(flash.destAmount);
  const minDestAmount = BigInt(initialCapital?.minDestAmount ?? 0n) + BigInt(flash.minDestAmount);
  return {
    kind: 'pendle-pt-leverage',
    srcToken: flash.srcToken,
    destToken: flash.destToken,
    srcAmount: srcAmount.toString(),
    destAmount: destAmount.toString(),
    minDestAmount: minDestAmount.toString(),
    initialCapital,
    flash,
  };
};

const metadataRequests = new Map<string, Promise<PendlePtMetadata>>();

const requireAddress = (value: string, field: string): Address => {
  if (!isAddress(value)) throw new Error(`Pendle returned an invalid ${field} address.`);
  return getAddress(value);
};

const getPendleValue = (value: string | number | null | undefined): bigint => {
  if (value == null || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    throw new Error('Pendle returned an invalid transaction value.');
  }
};

export const parsePendleConvertResponse = (raw: unknown, tokenOut: Address) => {
  const parsed = PendleConvertResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Pendle returned a malformed PT conversion response.');
  const route = parsed.data.routes.find((candidate) =>
    candidate.outputs.some((output) => isAddress(output.token) && isAddressEqual(output.token, tokenOut)),
  );
  if (!route) throw new Error('Pendle did not return the requested PT route.');
  const output = route.outputs.find((candidate) => isAddress(candidate.token) && isAddressEqual(candidate.token, tokenOut));
  if (!output) throw new Error('Pendle route omitted the expected output token.');
  if (!isHex(route.tx.data) || route.tx.data.length <= 10 || route.tx.data.length > MAX_PENDLE_CALLDATA_HEX_LENGTH) {
    throw new Error('Pendle returned invalid transaction calldata.');
  }

  return {
    action: parsed.data.action,
    data: route.tx.data,
    quotedOutputAmount: BigInt(output.amount),
    router: requireAddress(route.tx.to, 'router'),
    value: getPendleValue(route.tx.value),
  };
};

export const getPendlePtMetadata = async ({
  chainId,
  pt,
  publicClient,
}: {
  chainId: number;
  pt: Address;
  publicClient: PublicClient;
}): Promise<PendlePtMetadata> => {
  const key = `${chainId}:${pt.toLowerCase()}`;
  const cached = metadataRequests.get(key);
  if (cached) return cached;

  const request = (async () => {
    const [sy, yt, yieldContractFactory, expiry] = await publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address: pt, abi: pendlePtAbi, functionName: 'SY' },
        { address: pt, abi: pendlePtAbi, functionName: 'YT' },
        { address: pt, abi: pendlePtAbi, functionName: 'factory' },
        { address: pt, abi: pendlePtAbi, functionName: 'expiry' },
      ],
    });
    if (isAddressEqual(sy, zeroAddress) || isAddressEqual(yt, zeroAddress)) {
      throw new Error('Pendle PT metadata is incomplete.');
    }
    if (!isTrustedPendleYieldContractFactory(chainId, yieldContractFactory)) {
      throw new Error('Pendle PT yield-contract factory is not trusted on this chain.');
    }

    const [linkedPt, yieldToken, assetInfo, tokensIn, tokensOut, isRegisteredPt, isRegisteredYt, registeredPt, registeredYt] =
      await publicClient.multicall({
        allowFailure: false,
        contracts: [
          { address: yt, abi: pendleYtAbi, functionName: 'PT' },
          { address: sy, abi: pendleSyAbi, functionName: 'yieldToken' },
          { address: sy, abi: pendleSyAbi, functionName: 'assetInfo' },
          { address: sy, abi: pendleSyAbi, functionName: 'getTokensIn' },
          { address: sy, abi: pendleSyAbi, functionName: 'getTokensOut' },
          { address: yieldContractFactory, abi: pendleYieldContractFactoryAbi, functionName: 'isPT', args: [pt] },
          { address: yieldContractFactory, abi: pendleYieldContractFactoryAbi, functionName: 'isYT', args: [yt] },
          { address: yieldContractFactory, abi: pendleYieldContractFactoryAbi, functionName: 'getPT', args: [sy, expiry] },
          { address: yieldContractFactory, abi: pendleYieldContractFactoryAbi, functionName: 'getYT', args: [sy, expiry] },
        ],
      });
    if (!isAddressEqual(linkedPt, pt)) throw new Error('Pendle YT does not reference the expected PT.');
    if (!isRegisteredPt || !isRegisteredYt || !isAddressEqual(registeredPt, pt) || !isAddressEqual(registeredYt, yt)) {
      throw new Error('Pendle yield-contract factory does not recognize the PT/YT pair.');
    }

    const accountingAsset = assetInfo[1];
    const preferredUnderlying = isAddressEqual(yieldToken, zeroAddress) ? accountingAsset : yieldToken;
    const supportsRoundTrip = (token: Address) =>
      tokensIn.some((candidate) => isAddressEqual(candidate, token)) && tokensOut.some((candidate) => isAddressEqual(candidate, token));
    const underlyingToken = supportsRoundTrip(preferredUnderlying)
      ? preferredUnderlying
      : supportsRoundTrip(accountingAsset)
        ? accountingAsset
        : null;
    if (!underlyingToken) throw new Error('Pendle SY does not expose a supported underlying token.');

    const underlyingDecimals = isAddressEqual(underlyingToken, accountingAsset)
      ? assetInfo[2]
      : await publicClient.readContract({ address: underlyingToken, abi: erc20Abi, functionName: 'decimals' });

    return {
      acceptedInputs: tokensIn.map(getAddress),
      acceptedOutputs: tokensOut.map(getAddress),
      expiry,
      pt: getAddress(pt),
      sy: getAddress(sy),
      yt: getAddress(yt),
      underlyingToken: getAddress(underlyingToken),
      underlyingDecimals,
    };
  })();

  metadataRequests.set(key, request);
  try {
    return await request;
  } catch (error) {
    if (metadataRequests.get(key) === request) metadataRequests.delete(key);
    throw error;
  }
};

const fetchPendleConvert = async ({
  amount,
  chainId,
  receiver,
  signal,
  slippageBps,
  tokenIn,
  tokenOut,
}: {
  amount: bigint;
  chainId: number;
  receiver: Address;
  signal?: AbortSignal;
  slippageBps: number;
  tokenIn: Address;
  tokenOut: Address;
}) => {
  if (amount <= 0n) throw new Error('Pendle input amount must be positive.');
  if (!Number.isFinite(slippageBps) || slippageBps <= 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error('Pendle slippage exceeds the supported bound.');
  }
  const response = await fetch(`${PENDLE_API_BASE_URL}/v3/sdk/${chainId}/convert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      receiver,
      slippage: slippageBps / 10_000,
      enableAggregator: false,
      inputs: [{ token: tokenIn, amount: amount.toString() }],
      outputs: [tokenOut],
    }),
    signal,
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      raw && typeof raw === 'object' && 'message' in raw
        ? Array.isArray(raw.message)
          ? raw.message.join(' ')
          : String(raw.message)
        : `Pendle quote API error ${response.status}`;
    throw new Error(message);
  }

  return parsePendleConvertResponse(raw, tokenOut);
};

const assertPendleMarket = async ({
  chainId,
  market,
  metadata,
  publicClient,
}: {
  chainId: number;
  market: Address;
  metadata: PendlePtMetadata;
  publicClient: PublicClient;
}) => {
  const [[sy, pt, yt], factory] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: market, abi: pendleMarketAbi, functionName: 'readTokens' },
      { address: market, abi: pendleMarketAbi, functionName: 'factory' },
    ],
  });
  if (!isAddressEqual(sy, metadata.sy) || !isAddressEqual(pt, metadata.pt) || !isAddressEqual(yt, metadata.yt)) {
    throw new Error('Pendle route market does not match the collateral PT.');
  }
  if (!isTrustedPendleMarketFactory(chainId, factory)) throw new Error('Pendle route market factory is not trusted on this chain.');
  const isValidMarket = await publicClient.readContract({
    address: factory,
    abi: pendleMarketFactoryAbi,
    functionName: 'isValidMarket',
    args: [market],
  });
  if (!isValidMarket) throw new Error('Pendle factory does not recognize the quoted market.');
};

const quotePendleBuy = async ({
  amount,
  chainId,
  metadata,
  publicClient,
  receiver,
  signal,
  slippageBps,
}: {
  amount: bigint;
  chainId: number;
  metadata: PendlePtMetadata;
  publicClient: PublicClient;
  receiver: Address;
  signal?: AbortSignal;
  slippageBps: number;
}): Promise<PendleLeg> => {
  const route = await fetchPendleConvert({
    amount,
    chainId,
    receiver,
    signal,
    slippageBps,
    tokenIn: metadata.underlyingToken,
    tokenOut: metadata.pt,
  });
  if (!isAddressEqual(route.router, PENDLE_ROUTER_ADDRESS) || route.value !== 0n) {
    throw new Error('Pendle returned an unsupported router or native-value route.');
  }
  if (route.action !== 'swap') throw new Error('Pendle returned an unexpected PT buy action.');

  const { market, minOutputAmount } = validatePendleBuyCalldata({
    amount,
    data: route.data,
    metadata,
    quotedOutputAmount: route.quotedOutputAmount,
    receiver,
    slippageBps,
  });
  await assertPendleMarket({ chainId, market, metadata, publicClient });

  return {
    data: route.data,
    exactInputAmount: amount,
    executionKind: 'market-swap',
    market,
    minOutputAmount,
    quotedOutputAmount: route.quotedOutputAmount,
    router: route.router,
  };
};

const quotePendleSell = async ({
  amount,
  chainId,
  metadata,
  publicClient,
  receiver,
  signal,
  slippageBps,
}: {
  amount: bigint;
  chainId: number;
  metadata: PendlePtMetadata;
  publicClient: PublicClient;
  receiver: Address;
  signal?: AbortSignal;
  slippageBps: number;
}): Promise<PendleLeg> => {
  const route = await fetchPendleConvert({
    amount,
    chainId,
    receiver,
    signal,
    slippageBps,
    tokenIn: metadata.pt,
    tokenOut: metadata.underlyingToken,
  });
  if (!isAddressEqual(route.router, PENDLE_ROUTER_ADDRESS) || route.value !== 0n) {
    throw new Error('Pendle returned an unsupported router or native-value route.');
  }
  let executionKind: PendleLeg['executionKind'];
  let market: Address | null;
  let minOutputAmount: bigint;
  if (route.action === 'swap') {
    const validation = validatePendleSellCalldata({
      amount,
      data: route.data,
      metadata,
      quotedOutputAmount: route.quotedOutputAmount,
      receiver,
      slippageBps,
    });
    await assertPendleMarket({ chainId, market: validation.market, metadata, publicClient });
    executionKind = 'market-swap';
    market = validation.market;
    minOutputAmount = validation.minOutputAmount;
  } else if (route.action === 'redeem-py') {
    const validation = validatePendleRedeemCalldata({
      amount,
      data: route.data,
      metadata,
      quotedOutputAmount: route.quotedOutputAmount,
      receiver,
      slippageBps,
    });
    executionKind = 'redeem-py';
    market = null;
    minOutputAmount = validation.minOutputAmount;
  } else {
    throw new Error('Pendle returned an unsupported PT exit action.');
  }

  return {
    data: route.data,
    exactInputAmount: amount,
    executionKind,
    market,
    minOutputAmount,
    quotedOutputAmount: route.quotedOutputAmount,
    router: route.router,
  };
};

export const quotePendlePtLeverage = async ({
  amountIn,
  chainId,
  generalAdapterAddress,
  loanToken,
  loanTokenDecimals,
  paraswapAdapterAddress,
  pt,
  publicClient,
  signal,
  slippageBps,
}: {
  amountIn: bigint;
  chainId: number;
  generalAdapterAddress: Address;
  loanToken: Address;
  loanTokenDecimals: number;
  paraswapAdapterAddress: Address;
  pt: Address;
  publicClient: PublicClient;
  signal?: AbortSignal;
  slippageBps: number;
}): Promise<PendlePtSwapQuote> => {
  const metadata = await getPendlePtMetadata({ chainId, pt, publicClient });
  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
  if (latestBlock.timestamp >= metadata.expiry) throw new Error('This Pendle PT has expired and can no longer be levered.');
  let routeMetadata = metadata;
  let priceRoute = null;
  if (!isAddressEqual(loanToken, metadata.underlyingToken)) {
    try {
      priceRoute = await fetchVeloraPriceRoute({
        srcToken: loanToken,
        srcDecimals: loanTokenDecimals,
        destToken: metadata.underlyingToken,
        destDecimals: metadata.underlyingDecimals,
        amount: amountIn,
        network: chainId,
        userAddress: paraswapAdapterAddress,
        side: 'SELL',
        excludeDexs: LEVERAGE_SWAP_EXCLUDED_DEXS,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!hasAddress(metadata.acceptedInputs, loanToken)) throw error;
      // Some SYs accept the market loan token directly, so Velora is optional.
      routeMetadata = { ...metadata, underlyingToken: loanToken, underlyingDecimals: loanTokenDecimals };
    }
  }
  const quotedUnderlyingAmount = priceRoute ? BigInt(priceRoute.destAmount) : amountIn;
  const pendleInputAmount = priceRoute ? withSlippageFloor(quotedUnderlyingAmount, slippageBps) : amountIn;
  const pendle = await quotePendleBuy({
    amount: pendleInputAmount,
    chainId,
    metadata: routeMetadata,
    publicClient,
    receiver: generalAdapterAddress,
    signal,
    slippageBps,
  });

  return {
    kind: 'pendle-pt',
    direction: 'leverage',
    srcToken: loanToken,
    destToken: pt,
    srcAmount: amountIn.toString(),
    destAmount: pendle.quotedOutputAmount.toString(),
    minDestAmount: pendle.minOutputAmount.toString(),
    slippageBps,
    metadata: routeMetadata,
    pendle,
    externalSwap: priceRoute
      ? {
          priceRoute,
          inputAmount: amountIn,
          minOutputAmount: pendleInputAmount,
          quotedOutputAmount: quotedUnderlyingAmount,
        }
      : null,
  };
};

const scaleAmountCeil = (amount: bigint, fromDecimals: number, toDecimals: number): bigint => {
  if (toDecimals >= fromDecimals) return amount * 10n ** BigInt(toDecimals - fromDecimals);
  const divisor = 10n ** BigInt(fromDecimals - toDecimals);
  return (amount + divisor - 1n) / divisor;
};

const nextSellAmount = (sellAmount: bigint, received: bigint, target: bigint): bigint => {
  if (received <= 0n) return (sellAmount * 2n * TARGET_BUFFER_BPS + BPS - 1n) / BPS;
  const proportional = (sellAmount * target + received - 1n) / received;
  return (proportional * TARGET_BUFFER_BPS + BPS - 1n) / BPS;
};

export const quotePendlePtForMinimumOutput = async ({
  collateralDecimals,
  minimumPtOut,
  ...params
}: Omit<Parameters<typeof quotePendlePtLeverage>[0], 'amountIn'> & {
  collateralDecimals: number;
  minimumPtOut: bigint;
}): Promise<PendlePtSwapQuote> => {
  const metadata = await getPendlePtMetadata({ chainId: params.chainId, pt: params.pt, publicClient: params.publicClient });
  const targetUnderlying = scaleAmountCeil(minimumPtOut, collateralDecimals, metadata.underlyingDecimals);
  let sellAmount: bigint;
  if (isAddressEqual(params.loanToken, metadata.underlyingToken)) {
    sellAmount = targetUnderlying;
  } else {
    try {
      sellAmount = BigInt(
        (
          await fetchVeloraPriceRoute({
            srcToken: params.loanToken,
            srcDecimals: params.loanTokenDecimals,
            destToken: metadata.underlyingToken,
            destDecimals: metadata.underlyingDecimals,
            amount: targetUnderlying,
            network: params.chainId,
            userAddress: params.paraswapAdapterAddress,
            side: 'BUY',
            excludeDexs: LEVERAGE_SWAP_EXCLUDED_DEXS,
          })
        ).srcAmount,
      );
    } catch (error) {
      if (params.signal?.aborted) throw error;
      if (!hasAddress(metadata.acceptedInputs, params.loanToken)) throw error;
      sellAmount = scaleAmountCeil(minimumPtOut, collateralDecimals, params.loanTokenDecimals);
    }
  }

  let quote: PendlePtSwapQuote | null = null;
  for (let attempt = 0; attempt < MAX_SIZE_ATTEMPTS; attempt += 1) {
    quote = await quotePendlePtLeverage({ ...params, amountIn: sellAmount });
    const received = BigInt(quote.minDestAmount);
    if (received >= minimumPtOut) return quote;
    sellAmount = nextSellAmount(sellAmount, received, minimumPtOut);
  }
  throw new Error('Failed to size Pendle route for target leverage. Try a lower multiplier or refresh the quote.');
};

export const quotePendlePtDeleverage = async ({
  amountIn,
  chainId,
  generalAdapterAddress,
  loanToken,
  loanTokenDecimals,
  paraswapAdapterAddress,
  pt,
  publicClient,
  signal,
  slippageBps,
}: {
  amountIn: bigint;
  chainId: number;
  generalAdapterAddress: Address;
  loanToken: Address;
  loanTokenDecimals: number;
  paraswapAdapterAddress: Address;
  pt: Address;
  publicClient: PublicClient;
  signal?: AbortSignal;
  slippageBps: number;
}): Promise<PendlePtSwapQuote> => {
  const metadata = await getPendlePtMetadata({ chainId, pt, publicClient });
  const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
  let routeMetadata = metadata;
  let pendle = await quotePendleSell({
    amount: amountIn,
    chainId,
    metadata,
    publicClient,
    receiver: generalAdapterAddress,
    signal,
    slippageBps,
  });
  let priceRoute = null;
  if (!isAddressEqual(loanToken, metadata.underlyingToken)) {
    try {
      priceRoute = await fetchVeloraPriceRoute({
        srcToken: metadata.underlyingToken,
        srcDecimals: metadata.underlyingDecimals,
        destToken: loanToken,
        destDecimals: loanTokenDecimals,
        amount: pendle.minOutputAmount,
        network: chainId,
        userAddress: paraswapAdapterAddress,
        side: 'SELL',
        excludeDexs: LEVERAGE_SWAP_EXCLUDED_DEXS,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!hasAddress(metadata.acceptedOutputs, loanToken)) throw error;
      routeMetadata = { ...metadata, underlyingToken: loanToken, underlyingDecimals: loanTokenDecimals };
      pendle = await quotePendleSell({
        amount: amountIn,
        chainId,
        metadata: routeMetadata,
        publicClient,
        receiver: generalAdapterAddress,
        signal,
        slippageBps,
      });
    }
  }
  const isExpired = latestBlock.timestamp >= metadata.expiry;
  if (isExpired !== (pendle.executionKind === 'redeem-py')) {
    throw new Error('Pendle PT maturity changed while quoting. Refresh the route and try again.');
  }
  const quotedLoanAmount = priceRoute ? BigInt(priceRoute.destAmount) : pendle.quotedOutputAmount;
  const minLoanAmount = priceRoute ? withSlippageFloor(quotedLoanAmount, slippageBps) : pendle.minOutputAmount;

  return {
    kind: 'pendle-pt',
    direction: 'deleverage',
    srcToken: pt,
    destToken: loanToken,
    srcAmount: amountIn.toString(),
    destAmount: quotedLoanAmount.toString(),
    minDestAmount: minLoanAmount.toString(),
    slippageBps,
    metadata: routeMetadata,
    pendle,
    externalSwap: priceRoute
      ? {
          priceRoute,
          inputAmount: pendle.minOutputAmount,
          minOutputAmount: minLoanAmount,
          quotedOutputAmount: quotedLoanAmount,
        }
      : null,
  };
};
