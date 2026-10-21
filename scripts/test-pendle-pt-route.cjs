'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');

for (const extension of ['.jpeg', '.jpg', '.png', '.svg', '.webp']) {
  require.extensions[extension] = () => {};
}
require('tsx/cjs');

const {
  decodeAbiParameters,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddressEqual,
  keccak256,
  maxUint256,
  zeroAddress,
} = require('viem');
const { bundlerV3Abi } = require('../src/abis/bundlerV3.ts');
const { morphoGeneralAdapterV1Abi } = require('../src/abis/morphoGeneralAdapterV1.ts');
const { paraswapAdapterAbi } = require('../src/abis/paraswapAdapter.ts');
const { pendleRouterAbi } = require('../src/abis/pendle.ts');
const permit2Abi = require('../src/abis/permit2.ts').default;
const { deleverageWithSwap } = require('../src/hooks/deleverage/deleverageWithSwap.ts');
const { getDeleverageRepayBounds } = require('../src/hooks/deleverage/transaction-shared.ts');
const { leverageWithSwap } = require('../src/hooks/leverage/leverageWithSwap.ts');
const { getBorrowSharesSlippageAmount } = require('../src/hooks/leverage/math.ts');
const { getPendleSweepTokens } = require('../src/hooks/leverage/pendle-bundler.ts');
const { computeMinSharePriceE27 } = require('../src/hooks/leverage/velora-precheck.ts');
const { parsePendleConvertResponse, quotePendlePtDeleverage, quotePendlePtLeverage } = require('../src/hooks/leverage/pendle.ts');
const { PERMIT2_ADDRESS } = require('../src/utils/permit2.ts');
const { getRouteLeverageFee } = require('../src/hooks/leverage/fees.ts');
const {
  isTrustedPendleMarketFactory,
  isTrustedPendleYieldContractFactory,
  PENDLE_LIMIT_ROUTER_ADDRESS,
  PENDLE_ROUTER_ADDRESS,
} = require('../src/hooks/leverage/pendle-config.ts');
const {
  assertExecutablePendleQuote,
  validatePendleBuyCalldata,
  validatePendleRedeemCalldata,
  validatePendleSellCalldata,
} = require('../src/hooks/leverage/pendle-validation.ts');

const RECEIVER = getAddress('0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0');
const OTHER_RECEIVER = getAddress('0x1111111111111111111111111111111111111111');
const MARKET = getAddress('0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e');
const PT = getAddress('0x7f47c3e6b2c00fc4eb4d5ae50d0ab0ab6888eb4d');
const SY = getAddress('0xea3bc608f32847b97965c5e1648bdfcd4c2c40d0');
const YT = getAddress('0x5cffcc9ddef0fdcf395e2ea24ca5ed5a12032706');
const UNDERLYING = getAddress('0x056b269eb1f75477a8666ae8c7fe01b64dd55ecc');
const LOAN = getAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
const BUNDLER = getAddress('0x6566194141eefa99Af43Bb5Aa71460Ca2Dc90245');
const PARASWAP_ADAPTER = getAddress('0x03b5259Bd204BfD4A616E5B79b0B786d90c6C38f');
const AMOUNT = 1_000_000n;
const QUOTED_OUTPUT = 1_100_000n;
const MIN_OUTPUT = 1_098_900n;
const YIELD_CONTRACT_FACTORY = getAddress('0x3E6EBa46AbC5ab18ED95F6667d8B2fd4020E4637');
const MARKET_FACTORY = getAddress('0x6d247b1c044fA1E22e6B04fA9F71Baf99EB29A9f');
const BUNDLER_CALLS_ABI = [
  {
    type: 'tuple[]',
    components: [
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'skipRevert', type: 'bool' },
      { name: 'callbackHash', type: 'bytes32' },
    ],
  },
];
const decodeCallback = (flashCall) => decodeAbiParameters(BUNDLER_CALLS_ABI, flashCall.args[2])[0];
const decodeCall = (abi, call) => decodeFunctionData({ abi, data: call.data });
const hasFunction = (abi, call, functionName) => {
  try {
    return decodeCall(abi, call).functionName === functionName;
  } catch {
    return false;
  }
};
const assertSweepCalls = (calls, tokens, recipient) => {
  assert.equal(calls.length, tokens.length * 2);
  const adapters = [
    { abi: morphoGeneralAdapterV1Abi, address: RECEIVER },
    { abi: paraswapAdapterAbi, address: PARASWAP_ADAPTER },
  ];
  for (const [adapterIndex, adapter] of adapters.entries()) {
    for (const [tokenIndex, token] of tokens.entries()) {
      const call = calls[adapterIndex * tokens.length + tokenIndex];
      assert.equal(call.to, adapter.address);
      const decoded = decodeCall(adapter.abi, call);
      assert.equal(decoded.functionName, 'erc20Transfer');
      assert.deepEqual(decoded.args, [token, recipient, maxUint256]);
    }
  }
};

const metadata = {
  acceptedInputs: [UNDERLYING],
  acceptedOutputs: [UNDERLYING],
  expiry: 1_800_000_000n,
  pt: PT,
  sy: SY,
  yt: YT,
  underlyingToken: UNDERLYING,
  underlyingDecimals: 6,
};
const route = {
  kind: 'swap',
  conversion: 'pendle-pt',
  bundler3Address: BUNDLER,
  generalAdapterAddress: RECEIVER,
  paraswapAdapterAddress: PARASWAP_ADAPTER,
};
const market = {
  uniqueKey: `0x${'11'.repeat(32)}`,
  loanAsset: { address: LOAN, decimals: 6, symbol: 'USDC' },
  collateralAsset: { address: PT, decimals: 6, symbol: 'PT-USD3-17DEC2026' },
  morphoBlue: { chain: { id: 1 } },
  state: { borrowAssets: '1000000000', borrowShares: '1000000000000000' },
};
const marketParams = {
  loanToken: LOAN,
  collateralToken: PT,
  oracle: getAddress('0x2222222222222222222222222222222222222222'),
  irm: getAddress('0x3333333333333333333333333333333333333333'),
  lltv: 915_000_000_000_000_000n,
};
const emptySwap = {
  swapType: 0,
  extRouter: zeroAddress,
  extCalldata: '0x',
  needScale: false,
};
const emptyLimit = {
  limitRouter: zeroAddress,
  epsSkipMarket: 0n,
  normalFills: [],
  flashFills: [],
  optData: '0x',
};

test('parses only well-formed Pendle API routes for the requested output', () => {
  const parsed = parsePendleConvertResponse(
    {
      action: 'swap',
      routes: [
        { outputs: [{ token: PT, amount: QUOTED_OUTPUT.toString() }], tx: { to: PENDLE_ROUTER_ADDRESS, data: encodeBuy(), value: '0' } },
      ],
    },
    PT,
  );
  assert.equal(parsed.router, PENDLE_ROUTER_ADDRESS);
  assert.equal(parsed.quotedOutputAmount, QUOTED_OUTPUT);
  assert.throws(() => parsePendleConvertResponse({ action: 'swap', routes: [] }, PT), /requested PT route/);
  assert.throws(
    () =>
      parsePendleConvertResponse(
        { action: 'swap', routes: [{ outputs: [{ token: PT, amount: '1' }], tx: { to: PENDLE_ROUTER_ADDRESS } }] },
        PT,
      ),
    /malformed/,
  );
});

test('caps leverage fees when priced and falls back to the base rate when unpriced', () => {
  const params = { amount: 1_000_000_000_000n, assetDecimals: 6, assetPriceUsd: 1 };
  assert.equal(getRouteLeverageFee({ ...params, route: { ...route, conversion: 'generic' } }), 5_000_000n);
  assert.equal(getRouteLeverageFee({ ...params, route }), 10_000_000n);
  assert.equal(getRouteLeverageFee({ ...params, assetPriceUsd: null, route: { ...route, conversion: 'generic' } }), 75_000_000n);
  assert.equal(getRouteLeverageFee({ ...params, assetPriceUsd: null, route }), 75_000_000n);
});

test('falls back to direct SY routes only for supported loan tokens', async () => {
  const readContract = async ({ address, functionName }) => {
    if (functionName === 'SY') return SY;
    if (functionName === 'YT') return YT;
    if (functionName === 'expiry') return 1_800_000_000n;
    if (functionName === 'factory') return address === PT ? YIELD_CONTRACT_FACTORY : MARKET_FACTORY;
    if (functionName === 'PT') return PT;
    if (functionName === 'yieldToken') return UNDERLYING;
    if (functionName === 'assetInfo') return [0, UNDERLYING, 6];
    if (functionName === 'getTokensIn' || functionName === 'getTokensOut') return [LOAN, UNDERLYING];
    if (functionName === 'isPT' || functionName === 'isYT' || functionName === 'isValidMarket') return true;
    if (functionName === 'getPT') return PT;
    if (functionName === 'getYT') return YT;
    if (functionName === 'readTokens') return [SY, PT, YT];
    throw new Error(`Unexpected contract read: ${functionName}`);
  };
  const publicClient = {
    getBlock: async () => ({ timestamp: 1_700_000_000n }),
    multicall: async ({ contracts }) => Promise.all(contracts.map(readContract)),
    readContract,
  };
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    if (String(url).includes('api.paraswap.io')) {
      return new Response(JSON.stringify({ error: 'forced Velora outage' }), { status: 503 });
    }
    const body = JSON.parse(init.body);
    const tokenIn = getAddress(body.inputs[0].token);
    const tokenOut = getAddress(body.outputs[0]);
    const data = tokenOut === PT ? encodeBuy({ tokenIn }) : encodeSell({ tokenOut });
    return new Response(
      JSON.stringify({
        action: 'swap',
        routes: [{ outputs: [{ token: tokenOut, amount: QUOTED_OUTPUT.toString() }], tx: { to: PENDLE_ROUTER_ADDRESS, data, value: '0' } }],
      }),
      { status: 200 },
    );
  };

  const params = {
    amountIn: AMOUNT,
    chainId: 1,
    generalAdapterAddress: RECEIVER,
    loanToken: LOAN,
    loanTokenDecimals: 6,
    paraswapAdapterAddress: PARASWAP_ADAPTER,
    pt: PT,
    publicClient,
    slippageBps: 10,
  };
  try {
    const [buy, sell] = await Promise.all([quotePendlePtLeverage(params), quotePendlePtDeleverage(params)]);
    assert.equal(buy.externalSwap, null);
    assert.equal(sell.externalSwap, null);
    assert.equal(buy.metadata.underlyingToken, LOAN);
    assert.equal(sell.metadata.underlyingToken, LOAN);
    await assert.rejects(quotePendlePtLeverage({ ...params, loanToken: OTHER_RECEIVER, loanTokenDecimals: 18 }), /forced Velora outage/);
  } finally {
    global.fetch = originalFetch;
  }
});

const encodeBuy = ({
  amount = AMOUNT,
  limit = emptyLimit,
  minOutput = MIN_OUTPUT,
  receiver = RECEIVER,
  swapData = emptySwap,
  tokenIn = UNDERLYING,
} = {}) =>
  encodeFunctionData({
    abi: pendleRouterAbi,
    functionName: 'swapExactTokenForPt',
    args: [
      receiver,
      MARKET,
      minOutput,
      { guessMin: 0n, guessMax: QUOTED_OUTPUT, guessOffchain: QUOTED_OUTPUT, maxIteration: 30n, eps: 10_000_000_000_000n },
      { tokenIn, netTokenIn: amount, tokenMintSy: tokenIn, pendleSwap: zeroAddress, swapData },
      limit,
    ],
  });

const encodeSell = ({ limit = emptyLimit, minOutput = MIN_OUTPUT, tokenOut = UNDERLYING } = {}) =>
  encodeFunctionData({
    abi: pendleRouterAbi,
    functionName: 'swapExactPtForToken',
    args: [
      RECEIVER,
      MARKET,
      AMOUNT,
      { tokenOut, minTokenOut: minOutput, tokenRedeemSy: tokenOut, pendleSwap: zeroAddress, swapData: emptySwap },
      limit,
    ],
  });

const encodeRedeem = ({ minOutput = MIN_OUTPUT, yt = YT } = {}) =>
  encodeFunctionData({
    abi: pendleRouterAbi,
    functionName: 'redeemPyToToken',
    args: [
      RECEIVER,
      yt,
      AMOUNT,
      { tokenOut: UNDERLYING, minTokenOut: minOutput, tokenRedeemSy: UNDERLYING, pendleSwap: zeroAddress, swapData: emptySwap },
    ],
  });

const malformedDirectQuote = (direction) => ({
  kind: 'pendle-pt',
  direction,
  srcToken: direction === 'leverage' ? LOAN : PT,
  destToken: direction === 'leverage' ? PT : LOAN,
  srcAmount: AMOUNT.toString(),
  destAmount: QUOTED_OUTPUT.toString(),
  minDestAmount: MIN_OUTPUT.toString(),
  slippageBps: 10,
  metadata: { ...metadata, underlyingToken: LOAN },
  pendle: {
    data: encodeBuy(),
    exactInputAmount: AMOUNT,
    executionKind: 'market-swap',
    market: MARKET,
    minOutputAmount: MIN_OUTPUT,
    quotedOutputAmount: QUOTED_OUTPUT,
    router: PENDLE_ROUTER_ADDRESS,
  },
  externalSwap: null,
});

const malformedLeveragePlan = () => {
  const flash = malformedDirectQuote('leverage');
  return {
    kind: 'pendle-pt-leverage',
    srcToken: flash.srcToken,
    destToken: flash.destToken,
    srcAmount: flash.srcAmount,
    destAmount: flash.destAmount,
    minDestAmount: flash.minDestAmount,
    initialCapital: null,
    flash,
  };
};

const directLeverageQuote = () => ({
  kind: 'pendle-pt',
  direction: 'leverage',
  srcToken: LOAN,
  destToken: PT,
  srcAmount: AMOUNT.toString(),
  destAmount: QUOTED_OUTPUT.toString(),
  minDestAmount: MIN_OUTPUT.toString(),
  slippageBps: 10,
  metadata: { ...metadata, underlyingToken: LOAN },
  pendle: {
    data: encodeBuy({ tokenIn: LOAN }),
    exactInputAmount: AMOUNT,
    executionKind: 'market-swap',
    market: MARKET,
    minOutputAmount: MIN_OUTPUT,
    quotedOutputAmount: QUOTED_OUTPUT,
    router: PENDLE_ROUTER_ADDRESS,
  },
  externalSwap: null,
});

const encodeWord = (value) => value.toString(16).padStart(64, '0');
const paraswapCalldata = `0x12345678${encodeWord(AMOUNT)}${encodeWord(AMOUNT)}${encodeWord(AMOUNT)}`;
const externalLeverageQuote = () => {
  const direct = directLeverageQuote();
  return {
    ...direct,
    metadata,
    pendle: { ...direct.pendle, data: encodeBuy() },
    externalSwap: {
      priceRoute: {
        srcToken: LOAN,
        destToken: UNDERLYING,
        srcAmount: AMOUNT.toString(),
        destAmount: AMOUNT.toString(),
        contractAddress: OTHER_RECEIVER,
      },
      inputAmount: AMOUNT,
      minOutputAmount: AMOUNT,
      quotedOutputAmount: AMOUNT,
    },
  };
};

const directDeleverageQuote = () => ({
  kind: 'pendle-pt',
  direction: 'deleverage',
  srcToken: PT,
  destToken: LOAN,
  srcAmount: AMOUNT.toString(),
  destAmount: QUOTED_OUTPUT.toString(),
  minDestAmount: MIN_OUTPUT.toString(),
  slippageBps: 10,
  metadata: { ...metadata, underlyingToken: LOAN },
  pendle: {
    data: encodeSell({ tokenOut: LOAN }),
    exactInputAmount: AMOUNT,
    executionKind: 'market-swap',
    market: MARKET,
    minOutputAmount: MIN_OUTPUT,
    quotedOutputAmount: QUOTED_OUTPUT,
    router: PENDLE_ROUTER_ADDRESS,
  },
  externalSwap: null,
});

const phasedLeveragePlan = () => {
  const initialCapital = directLeverageQuote();
  const flash = directLeverageQuote();
  return {
    kind: 'pendle-pt-leverage',
    srcToken: LOAN,
    destToken: PT,
    srcAmount: (AMOUNT * 2n).toString(),
    destAmount: (QUOTED_OUTPUT * 2n).toString(),
    minDestAmount: (MIN_OUTPUT * 2n).toString(),
    initialCapital,
    flash,
  };
};

test('accepts a direct Pendle PT buy with exact reviewed bounds', () => {
  const result = validatePendleBuyCalldata({
    amount: AMOUNT,
    data: encodeBuy(),
    metadata,
    quotedOutputAmount: QUOTED_OUTPUT,
    receiver: RECEIVER,
    slippageBps: 10,
  });
  assert.equal(result.market, MARKET);
  assert.equal(result.minOutputAmount, MIN_OUTPUT);
});

test('rejects a Pendle PT buy that embeds another aggregator', () => {
  const data = encodeBuy({
    swapData: {
      swapType: 1,
      extRouter: OTHER_RECEIVER,
      extCalldata: '0x1234',
      needScale: false,
    },
  });
  assert.throws(
    () =>
      validatePendleBuyCalldata({
        amount: AMOUNT,
        data,
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /nested aggregator/,
  );
});

test('rejects a Pendle PT buy with the wrong receiver', () => {
  assert.throws(
    () =>
      validatePendleBuyCalldata({
        amount: AMOUNT,
        data: encodeBuy({ receiver: OTHER_RECEIVER }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /receiver/,
  );
});

test('rejects a Pendle PT buy using an untrusted limit router', () => {
  assert.throws(
    () =>
      validatePendleBuyCalldata({
        amount: AMOUNT,
        data: encodeBuy({ limit: { ...emptyLimit, limitRouter: OTHER_RECEIVER } }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /untrusted limit router/,
  );
});

test('rejects a Pendle PT buy whose encoded minimum is below local slippage', () => {
  assert.throws(
    () =>
      validatePendleBuyCalldata({
        amount: AMOUNT,
        data: encodeBuy({ minOutput: MIN_OUTPUT - 1n }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /amounts/,
  );
});

test('rejects a canonical Pendle limit order with the wrong PT direction', () => {
  const wrongDirectionFill = {
    order: {
      salt: 1n,
      expiry: 1_900_000_000n,
      nonce: 0n,
      orderType: 0,
      token: UNDERLYING,
      YT,
      maker: OTHER_RECEIVER,
      receiver: OTHER_RECEIVER,
      makingAmount: AMOUNT,
      lnImpliedRate: 1n,
      failSafeRate: 1n,
      permit: '0x',
    },
    signature: '0x',
    makingAmount: AMOUNT,
  };
  assert.throws(
    () =>
      validatePendleBuyCalldata({
        amount: AMOUNT,
        data: encodeBuy({
          limit: { ...emptyLimit, limitRouter: PENDLE_LIMIT_ROUTER_ADDRESS, flashFills: [wrongDirectionFill] },
        }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /order type/,
  );
});

test('accepts a direct Pendle PT sell with exact reviewed bounds', () => {
  const result = validatePendleSellCalldata({
    amount: AMOUNT,
    data: encodeSell(),
    metadata,
    quotedOutputAmount: QUOTED_OUTPUT,
    receiver: RECEIVER,
    slippageBps: 10,
  });
  assert.equal(result.market, MARKET);
  assert.equal(result.minOutputAmount, MIN_OUTPUT);
});

test('accepts a canonical PT sell flash order denominated in SY', () => {
  const syFlashFill = {
    order: {
      salt: 1n,
      expiry: 1_900_000_000n,
      nonce: 0n,
      orderType: 3,
      token: SY,
      YT,
      maker: OTHER_RECEIVER,
      receiver: OTHER_RECEIVER,
      makingAmount: AMOUNT,
      lnImpliedRate: 1n,
      failSafeRate: 1n,
      permit: '0x',
    },
    signature: '0x',
    makingAmount: AMOUNT,
  };
  const result = validatePendleSellCalldata({
    amount: AMOUNT,
    data: encodeSell({ limit: { ...emptyLimit, limitRouter: PENDLE_LIMIT_ROUTER_ADDRESS, flashFills: [syFlashFill] } }),
    metadata,
    quotedOutputAmount: QUOTED_OUTPUT,
    receiver: RECEIVER,
    slippageBps: 10,
  });
  assert.equal(result.minOutputAmount, MIN_OUTPUT);
});

test('rejects Pendle sell output above the reviewed quote', () => {
  assert.throws(
    () =>
      validatePendleSellCalldata({
        amount: AMOUNT,
        data: encodeSell({ minOutput: QUOTED_OUTPUT + 1n }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /amounts/,
  );
});

test('accepts post-expiry PT redemption and rejects a mismatched YT', () => {
  const result = validatePendleRedeemCalldata({
    amount: AMOUNT,
    data: encodeRedeem(),
    metadata,
    quotedOutputAmount: QUOTED_OUTPUT,
    receiver: RECEIVER,
    slippageBps: 10,
  });
  assert.equal(result.minOutputAmount, MIN_OUTPUT);
  assert.throws(
    () =>
      validatePendleRedeemCalldata({
        amount: AMOUNT,
        data: encodeRedeem({ yt: OTHER_RECEIVER }),
        metadata,
        quotedOutputAmount: QUOTED_OUTPUT,
        receiver: RECEIVER,
        slippageBps: 10,
      }),
    /unexpected YT/,
  );
});

test('rejects a stale execution amount before bundle construction', () => {
  const quote = {
    kind: 'pendle-pt',
    direction: 'leverage',
    srcToken: LOAN,
    destToken: PT,
    srcAmount: AMOUNT.toString(),
    destAmount: QUOTED_OUTPUT.toString(),
    minDestAmount: MIN_OUTPUT.toString(),
    slippageBps: 10,
    metadata,
    pendle: {
      data: encodeBuy(),
      exactInputAmount: AMOUNT,
      executionKind: 'market-swap',
      market: MARKET,
      minOutputAmount: MIN_OUTPUT,
      quotedOutputAmount: QUOTED_OUTPUT,
      router: PENDLE_ROUTER_ADDRESS,
    },
    externalSwap: null,
  };
  assert.throws(
    () =>
      assertExecutablePendleQuote({
        direction: 'leverage',
        expectedAmountIn: AMOUNT + 1n,
        expectedLoanToken: LOAN,
        expectedPt: PT,
        expectedReceiver: RECEIVER,
        expectedSlippageBps: 10,
        quote,
      }),
    /no longer matches/,
  );
});

test('accepts only chain-scoped canonical Pendle market factories', () => {
  assert.equal(isTrustedPendleMarketFactory(1, getAddress('0x6d247b1c044fA1E22e6B04fA9F71Baf99EB29A9f')), true);
  assert.equal(isTrustedPendleMarketFactory(1, OTHER_RECEIVER), false);
  assert.equal(isTrustedPendleMarketFactory(8453, getAddress('0x6d247b1c044fA1E22e6B04fA9F71Baf99EB29A9f')), false);
});

test('accepts only chain-scoped canonical Pendle yield-contract factories', () => {
  assert.equal(isTrustedPendleYieldContractFactory(1, YIELD_CONTRACT_FACTORY), true);
  assert.equal(isTrustedPendleYieldContractFactory(1, OTHER_RECEIVER), false);
  assert.equal(isTrustedPendleYieldContractFactory(8453, YIELD_CONTRACT_FACTORY), false);
});

test('validates the full leverage route before creating approvals or Morpho authorization', async () => {
  let approved = false;
  let authorized = false;
  await assert.rejects(
    leverageWithSwap({
      account: OTHER_RECEIVER,
      bundlerAddress: BUNDLER,
      market,
      marketParams,
      route,
      initialCapitalInputTokenAddress: LOAN,
      initialCapitalTransferAmount: 0n,
      isLoanAssetInput: false,
      flashLoanAssetAmount: AMOUNT,
      flashLegCollateralTokenAmount: MIN_OUTPUT,
      totalCollateralTokenAmountAdded: MIN_OUTPUT,
      leverageFeeAmount: 0n,
      swapPriceRoute: malformedLeveragePlan(),
      slippageBps: 10,
      usePermit2: false,
      permit2Authorized: false,
      isBundlerAuthorized: false,
      authorizePermit2: async () => {
        approved = true;
      },
      ensureBundlerAuthorization: async () => {
        authorized = true;
        return { authorized: true };
      },
      signForBundlers: async () => {
        throw new Error('unexpected Permit2 signature');
      },
      isApproved: false,
      approve: async () => {
        approved = true;
      },
      updateStep: () => {},
      sendTransactionAsync: async () => {
        throw new Error('unexpected transaction');
      },
    }),
    /unexpected input token/,
  );
  assert.equal(approved, false);
  assert.equal(authorized, false);
});

test('composes the external swap and Pendle legs in the reference phase order', async () => {
  let transaction;
  const initialCapital = externalLeverageQuote();
  const flashQuote = externalLeverageQuote();
  const externalPlan = { ...phasedLeveragePlan(), initialCapital, flash: flashQuote };
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ to: OTHER_RECEIVER, data: paraswapCalldata }), { status: 200 });
  try {
    await leverageWithSwap({
      account: OTHER_RECEIVER,
      bundlerAddress: BUNDLER,
      market,
      marketParams,
      route,
      initialCapitalInputTokenAddress: LOAN,
      initialCapitalTransferAmount: AMOUNT,
      isLoanAssetInput: true,
      flashLoanAssetAmount: AMOUNT,
      flashLegCollateralTokenAmount: MIN_OUTPUT,
      totalCollateralTokenAmountAdded: MIN_OUTPUT * 2n,
      leverageFeeAmount: 0n,
      swapPriceRoute: externalPlan,
      slippageBps: 10,
      usePermit2: true,
      permit2Authorized: true,
      isBundlerAuthorized: true,
      authorizePermit2: async () => {
        throw new Error('unexpected Permit2 approval');
      },
      ensureBundlerAuthorization: async () => ({ authorized: true }),
      signForBundlers: async () => {
        const deadline = Math.floor(Date.now() / 1000) + 600;
        return {
          sigs: '0x12',
          permitSingle: {
            details: { token: LOAN, amount: AMOUNT, expiration: deadline, nonce: 0 },
            spender: RECEIVER,
            sigDeadline: BigInt(deadline),
          },
        };
      },
      isApproved: true,
      approve: async () => {},
      updateStep: () => {},
      sendTransactionAsync: async (tx) => {
        transaction = tx;
        return `0x${'12'.repeat(32)}`;
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const outer = decodeFunctionData({ abi: bundlerV3Abi, data: transaction.data.slice(0, -4) }).args[0];
  const flashIndex = outer.findIndex(
    (entry) => isAddressEqual(entry.to, RECEIVER) && hasFunction(morphoGeneralAdapterV1Abi, entry, 'morphoFlashLoan'),
  );
  assert.notEqual(flashIndex, -1);
  const beforeFlash = outer.slice(0, flashIndex);
  const beforeFlashAbis = [
    permit2Abi,
    morphoGeneralAdapterV1Abi,
    morphoGeneralAdapterV1Abi,
    paraswapAdapterAbi,
    morphoGeneralAdapterV1Abi,
    erc20Abi,
    pendleRouterAbi,
    morphoGeneralAdapterV1Abi,
  ];
  assert.deepEqual(
    beforeFlash.map((entry, index) => decodeCall(beforeFlashAbis[index], entry).functionName),
    ['permit', 'permit2TransferFrom', 'erc20Transfer', 'sell', 'erc20Transfer', 'approve', 'swapExactTokenForPt', 'morphoSupplyCollateral'],
  );
  assert.deepEqual(
    beforeFlash.map((entry) => entry.to),
    [PERMIT2_ADDRESS, RECEIVER, RECEIVER, PARASWAP_ADAPTER, RECEIVER, UNDERLYING, PENDLE_ROUTER_ADDRESS, RECEIVER],
  );
  assert.deepEqual(decodeCall(morphoGeneralAdapterV1Abi, beforeFlash[1]).args, [LOAN, RECEIVER, AMOUNT]);
  assert.deepEqual(decodeCall(morphoGeneralAdapterV1Abi, beforeFlash[2]).args, [LOAN, PARASWAP_ADAPTER, AMOUNT]);
  const initialExternalSwap = decodeCall(paraswapAdapterAbi, beforeFlash[3]);
  assert.equal(initialExternalSwap.args[2], LOAN);
  assert.equal(initialExternalSwap.args[3], UNDERLYING);
  assert.equal(initialExternalSwap.args[6], RECEIVER);
  const initialPendleSwap = decodeCall(pendleRouterAbi, beforeFlash[6]);
  assert.equal(initialPendleSwap.args[0], RECEIVER);
  assert.equal(initialPendleSwap.args[1], MARKET);
  assert.equal(initialPendleSwap.args[4].netTokenIn, AMOUNT);
  const initialSupply = decodeCall(morphoGeneralAdapterV1Abi, beforeFlash[7]);
  assert.equal(initialSupply.args[1], maxUint256);
  assert.equal(initialSupply.args[2], OTHER_RECEIVER);

  const flash = decodeFunctionData({ abi: morphoGeneralAdapterV1Abi, data: outer[flashIndex].data });
  assert.equal(flash.functionName, 'morphoFlashLoan');
  assert.equal(flash.args[0], LOAN);
  assert.equal(flash.args[1], AMOUNT);
  const callback = decodeCallback(flash);
  const callbackAbis = [
    morphoGeneralAdapterV1Abi,
    paraswapAdapterAbi,
    morphoGeneralAdapterV1Abi,
    erc20Abi,
    pendleRouterAbi,
    morphoGeneralAdapterV1Abi,
    morphoGeneralAdapterV1Abi,
  ];
  assert.deepEqual(
    callback.map((entry, index) => decodeCall(callbackAbis[index], entry).functionName),
    ['erc20Transfer', 'sell', 'erc20Transfer', 'approve', 'swapExactTokenForPt', 'morphoSupplyCollateral', 'morphoBorrow'],
  );
  assert.deepEqual(
    callback.map((entry) => entry.to),
    [RECEIVER, PARASWAP_ADAPTER, RECEIVER, UNDERLYING, PENDLE_ROUTER_ADDRESS, RECEIVER, RECEIVER],
  );
  const borrow = decodeCall(morphoGeneralAdapterV1Abi, callback[6]);
  assert.equal(borrow.args[1], AMOUNT);
  assert.ok(borrow.args[3] > 0n);
  assert.equal(borrow.args[4], RECEIVER);
  assert.equal(outer[flashIndex].callbackHash, keccak256(flash.args[2]));
  assert.ok([...outer, ...callback].every((entry) => entry.value === 0n && entry.skipRevert === false));
  assertSweepCalls(outer.slice(flashIndex + 1), [LOAN, PT, UNDERLYING, SY, YT], OTHER_RECEIVER);
});

test('accepts wallet PT plus a separately quoted flash conversion', async () => {
  let sent = false;
  const flash = directLeverageQuote();
  const plan = {
    ...phasedLeveragePlan(),
    srcAmount: flash.srcAmount,
    destAmount: flash.destAmount,
    minDestAmount: flash.minDestAmount,
    initialCapital: null,
  };
  await leverageWithSwap({
    account: OTHER_RECEIVER,
    bundlerAddress: BUNDLER,
    market,
    marketParams,
    route,
    initialCapitalInputTokenAddress: PT,
    initialCapitalTransferAmount: AMOUNT,
    isLoanAssetInput: false,
    flashLoanAssetAmount: AMOUNT,
    flashLegCollateralTokenAmount: MIN_OUTPUT,
    totalCollateralTokenAmountAdded: AMOUNT + MIN_OUTPUT,
    leverageFeeAmount: 0n,
    swapPriceRoute: plan,
    slippageBps: 10,
    usePermit2: false,
    permit2Authorized: false,
    isBundlerAuthorized: true,
    authorizePermit2: async () => {},
    ensureBundlerAuthorization: async () => ({ authorized: true }),
    signForBundlers: async () => {
      throw new Error('unexpected Permit2 signature');
    },
    isApproved: true,
    approve: async () => {},
    updateStep: () => {},
    sendTransactionAsync: async () => {
      sent = true;
      return `0x${'12'.repeat(32)}`;
    },
  });
  assert.equal(sent, true);
});

test('sweeps intermediate tokens from both leverage phases', () => {
  const initial = directLeverageQuote();
  const flash = { ...directLeverageQuote(), metadata };
  assert.deepEqual(new Set(getPendleSweepTokens(market, initial, flash)), new Set([LOAN, PT, UNDERLYING, SY, YT]));
});

test('validates the full deleverage route before creating Morpho authorization', async () => {
  let authorized = false;
  await assert.rejects(
    deleverageWithSwap({
      account: OTHER_RECEIVER,
      autoWithdrawCollateralAmount: 0n,
      bundlerAddress: BUNDLER,
      ensureBundlerAuthorization: async () => {
        authorized = true;
        return { authorized: true };
      },
      flashLoanAmount: AMOUNT,
      isBundlerAuthorized: false,
      market,
      marketParams,
      maxCollateralForDebtRepay: 0n,
      repayBySharesAmount: 0n,
      route,
      sendTransactionAsync: async () => {
        throw new Error('unexpected transaction');
      },
      slippageBps: 10,
      swapSellPriceRoute: malformedDirectQuote('deleverage'),
      updateStep: () => {},
      useCloseRoute: false,
      withdrawCollateralAmount: AMOUNT,
    }),
    /not swapExactPtForToken/,
  );
  assert.equal(authorized, false);
});

test('composes deleverage as repay then withdraw then Pendle conversion', async () => {
  let transaction;
  await deleverageWithSwap({
    account: OTHER_RECEIVER,
    autoWithdrawCollateralAmount: 0n,
    bundlerAddress: BUNDLER,
    ensureBundlerAuthorization: async () => ({ authorized: true }),
    flashLoanAmount: AMOUNT,
    isBundlerAuthorized: true,
    market,
    marketParams,
    maxCollateralForDebtRepay: 0n,
    repayBySharesAmount: 0n,
    route,
    sendTransactionAsync: async (tx) => {
      transaction = tx;
      return `0x${'12'.repeat(32)}`;
    },
    slippageBps: 10,
    swapSellPriceRoute: directDeleverageQuote(),
    updateStep: () => {},
    useCloseRoute: false,
    withdrawCollateralAmount: AMOUNT,
  });

  const outer = decodeFunctionData({ abi: bundlerV3Abi, data: transaction.data.slice(0, -4) }).args[0];
  const flash = decodeCall(morphoGeneralAdapterV1Abi, outer[0]);
  assert.equal(flash.functionName, 'morphoFlashLoan');
  assert.equal(flash.args[0], LOAN);
  assert.equal(flash.args[1], AMOUNT);
  const callback = decodeCallback(flash);
  const callbackAbis = [morphoGeneralAdapterV1Abi, morphoGeneralAdapterV1Abi, morphoGeneralAdapterV1Abi, erc20Abi, pendleRouterAbi];
  assert.deepEqual(
    callback.map((entry, index) => decodeCall(callbackAbis[index], entry).functionName),
    ['morphoRepay', 'morphoWithdrawCollateral', 'erc20Transfer', 'approve', 'swapExactPtForToken'],
  );
  assert.deepEqual(
    callback.map((entry) => entry.to),
    [RECEIVER, RECEIVER, RECEIVER, PT, PENDLE_ROUTER_ADDRESS],
  );
  const repay = decodeCall(morphoGeneralAdapterV1Abi, callback[0]);
  assert.equal(repay.args[1], AMOUNT);
  assert.ok(repay.args[3] > 0n);
  assert.equal(repay.args[4], OTHER_RECEIVER);
  const withdraw = decodeCall(morphoGeneralAdapterV1Abi, callback[1]);
  assert.equal(withdraw.args[1], AMOUNT);
  assert.equal(withdraw.args[2], RECEIVER);
  const pendleSell = decodeCall(pendleRouterAbi, callback[4]);
  assert.equal(pendleSell.args[0], RECEIVER);
  assert.equal(pendleSell.args[1], MARKET);
  assert.equal(pendleSell.args[2], AMOUNT);
  assert.equal(outer[0].callbackHash, keccak256(flash.args[2]));
  assert.ok([...outer, ...callback].every((entry) => entry.value === 0n && entry.skipRevert === false));
  assertSweepCalls(outer.slice(1), [LOAN, PT, SY, YT], OTHER_RECEIVER);
});

test('derives conservative Morpho borrow and repay share-price bounds', () => {
  const totalBorrowAssets = 1_000_000_000n;
  const totalBorrowShares = 1_000_000_000_000_000_000n;
  const assets = 100_000_000n;
  const nominalShares = (assets * totalBorrowShares) / totalBorrowAssets;
  const nominalSharePriceE27 = (assets * 10n ** 27n) / nominalShares;
  const maxBorrowShares = getBorrowSharesSlippageAmount({ borrowAssets: assets, totalBorrowAssets, totalBorrowShares });
  const minBorrowSharePriceE27 = computeMinSharePriceE27(assets, maxBorrowShares);
  assert.ok(maxBorrowShares > nominalShares);
  assert.ok(minBorrowSharePriceE27 > 0n && minBorrowSharePriceE27 < nominalSharePriceE27);

  const repayBounds = getDeleverageRepayBounds({
    flashLoanRepayAssets: assets,
    repayBySharesAmount: 0n,
    totalBorrowAssets,
    totalBorrowShares,
    useRepayByShares: false,
  });
  assert.ok(repayBounds.bundlerV2RepaySlippageAmount > 1n && repayBounds.bundlerV2RepaySlippageAmount < nominalShares);
  assert.ok(repayBounds.generalAdapterRepayMaxSharePriceE27 > nominalSharePriceE27);
});
