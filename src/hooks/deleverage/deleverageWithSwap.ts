import { type Address, encodeFunctionData, keccak256, zeroHash } from 'viem';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import { MAX_SLIPPAGE_BPS } from '@/features/swap/constants';
import { buildBundler3Erc20SweepCalls, type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets } from '@/hooks/leverage/bundler3';
import { withSlippageFloor } from '@/hooks/leverage/math';
import {
  type EnsureBundlerAuthorization,
  type MorphoMarketParams,
  type SendBundlerTransaction,
  assertCanonicalSwapRoute,
  sleep,
} from '@/hooks/leverage/transaction-shared';
import type { SwapLeverageRoute } from '@/hooks/leverage/types';
import { assertTrustedVeloraExecutionTarget, buildVeloraBundlerTransactionPayload } from '@/hooks/leverage/velora-transaction';
import { type ExecutableSwapQuote, isPendlePtSwapQuote, type PendlePtSwapQuote } from '@/hooks/leverage/pendle';
import { buildPendleConversionCalls, getPendleSweepTokens } from '@/hooks/leverage/pendle-bundler';
import { MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { type DeleverageStepType, getDeleverageRepayBounds } from './transaction-shared';

type DeleverageWithSwapParams = {
  account: Address;
  autoWithdrawCollateralAmount: bigint;
  bundlerAddress: Address;
  ensureBundlerAuthorization: EnsureBundlerAuthorization;
  flashLoanAmount: bigint;
  isBundlerAuthorized: boolean | undefined;
  market: Market;
  marketParams: MorphoMarketParams;
  maxCollateralForDebtRepay: bigint;
  repayBySharesAmount: bigint;
  route: SwapLeverageRoute;
  sendTransactionAsync: SendBundlerTransaction;
  slippageBps: number;
  swapSellPriceRoute: ExecutableSwapQuote;
  updateStep: (step: DeleverageStepType) => void;
  useCloseRoute: boolean;
  withdrawCollateralAmount: bigint;
};

export const deleverageWithSwap = async ({
  account,
  autoWithdrawCollateralAmount,
  bundlerAddress,
  ensureBundlerAuthorization,
  flashLoanAmount,
  isBundlerAuthorized,
  market,
  marketParams,
  maxCollateralForDebtRepay,
  repayBySharesAmount,
  route,
  sendTransactionAsync,
  slippageBps,
  swapSellPriceRoute,
  updateStep,
  useCloseRoute,
  withdrawCollateralAmount,
}: DeleverageWithSwapParams): Promise<void> => {
  if (!Number.isFinite(slippageBps) || slippageBps <= 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error('Invalid slippage tolerance. Please set a positive slippage value.');
  }
  assertCanonicalSwapRoute(market.morphoBlue.chain.id, bundlerAddress, route);

  if (useCloseRoute) {
    if (maxCollateralForDebtRepay <= 0n) {
      throw new Error('The exact close bound is unavailable. Refresh the quote and try again.');
    }
    if (withdrawCollateralAmount < maxCollateralForDebtRepay) {
      throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
    }
  }

  const { generalAdapterRepayMaxSharePriceE27 } = getDeleverageRepayBounds({
    flashLoanRepayAssets: flashLoanAmount,
    repayBySharesAmount,
    totalBorrowAssets: BigInt(market.state.borrowAssets),
    totalBorrowShares: BigInt(market.state.borrowShares),
    useRepayByShares: useCloseRoute,
  });

  const pendleQuote = isPendlePtSwapQuote(swapSellPriceRoute) ? swapSellPriceRoute : null;
  if ((route.conversion === 'pendle-pt') !== !!pendleQuote) {
    throw new Error('The executable quote does not match the selected deleverage route. Refresh and try again.');
  }

  let withdrawReceiver: Address;
  let conversionCalls: Bundler3Call[];
  let sweepTokenAddresses: Address[];
  if (pendleQuote) {
    if (BigInt(pendleQuote.minDestAmount) < flashLoanAmount) {
      throw new Error('Pendle deleverage quote changed. Please review the updated preview and try again.');
    }
    withdrawReceiver = route.generalAdapterAddress;
    conversionCalls = await buildPendleConversionCalls({
      bundlerAddress,
      direction: 'deleverage',
      expectedAmountIn: withdrawCollateralAmount,
      market,
      quote: pendleQuote,
      route,
      slippageBps,
    });
    sweepTokenAddresses = getPendleSweepTokens(market, pendleQuote);
  } else {
    withdrawReceiver = route.paraswapAdapterAddress;
    conversionCalls = await buildGenericDeleverageCalls({
      flashLoanAmount,
      market,
      quote: swapSellPriceRoute,
      route,
      slippageBps,
      useCloseRoute,
      withdrawCollateralAmount,
    });
    sweepTokenAddresses = [market.loanAsset.address as Address, market.collateralAsset.address as Address];
  }

  const callbackBundle: Bundler3Call[] = [
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoRepay',
        // Repay first so Morpho can release the exact collateral leg needed for the unwind.
        args: [
          marketParams,
          useCloseRoute ? 0n : flashLoanAmount,
          useCloseRoute ? repayBySharesAmount : 0n,
          generalAdapterRepayMaxSharePriceE27,
          account,
          '0x',
        ],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoWithdrawCollateral',
        args: [marketParams, withdrawCollateralAmount, withdrawReceiver],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    ...conversionCalls,
  ];

  if (autoWithdrawCollateralAmount > 0n) {
    callbackBundle.push({
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoWithdrawCollateral',
        args: [marketParams, autoWithdrawCollateralAmount, account],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    });
  }

  const callbackBundleData = encodeBundler3Calls(callbackBundle);
  const bundleCalls: Bundler3Call[] = [
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoFlashLoan',
        args: [market.loanAsset.address as Address, flashLoanAmount, callbackBundleData],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: keccak256(callbackBundleData),
    },
    ...buildBundler3Erc20SweepCalls({
      recipient: account,
      sweepTargets: [
        { adapterAbi: morphoGeneralAdapterV1Abi, adapterAddress: route.generalAdapterAddress },
        { adapterAbi: paraswapAdapterAbi, adapterAddress: route.paraswapAdapterAddress },
      ],
      tokenAddresses: sweepTokenAddresses,
    }),
  ];

  if (!isBundlerAuthorized) {
    updateStep('authorize_bundler_tx');
    const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
    if (!authorized) throw new Error('Failed to authorize Bundler via transaction.');
  }

  updateStep('execute');
  await sleep(700);

  await sendTransactionAsync({
    account,
    to: bundlerAddress,
    data: (encodeFunctionData({
      abi: bundlerV3Abi,
      functionName: 'multicall',
      args: [bundleCalls],
    }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
    value: 0n,
  });
};

type GenericSwapQuote = Exclude<ExecutableSwapQuote, PendlePtSwapQuote | { kind: 'pendle-pt-leverage' }>;

const buildGenericDeleverageCalls = async ({
  flashLoanAmount,
  market,
  quote,
  route,
  slippageBps,
  useCloseRoute,
  withdrawCollateralAmount,
}: {
  flashLoanAmount: bigint;
  market: Market;
  quote: GenericSwapQuote;
  route: SwapLeverageRoute;
  slippageBps: number;
  useCloseRoute: boolean;
  withdrawCollateralAmount: bigint;
}): Promise<Bundler3Call[]> => {
  const error = 'Deleverage quote changed. Please review the updated preview and try again.';
  const payload = await buildVeloraBundlerTransactionPayload({
    destinationTokenAddress: market.loanAsset.address,
    destinationTokenDecimals: market.loanAsset.decimals,
    executionAddress: route.paraswapAdapterAddress,
    network: market.morphoBlue.chain.id,
    priceRoute: quote,
    quoteChangedMessage: error,
    slippageBps,
    sourceTokenAddress: market.collateralAsset.address,
    sourceTokenAmount: withdrawCollateralAmount,
    sourceTokenDecimals: market.collateralAsset.decimals,
    sourceTokenSymbol: market.collateralAsset.symbol,
  });
  assertTrustedVeloraExecutionTarget({ priceRoute: quote, quoteChangedMessage: error, transactionTarget: payload.to });

  const minLoanAssetsOut = withSlippageFloor(BigInt(quote.destAmount), slippageBps);
  if ((useCloseRoute && minLoanAssetsOut < flashLoanAmount) || (!useCloseRoute && minLoanAssetsOut <= 0n)) {
    throw new Error(error);
  }
  const offsets = getParaswapSellOffsets({
    augustusCallData: payload.data,
    exactAmount: withdrawCollateralAmount,
    limitAmount: minLoanAssetsOut,
  });
  return [
    {
      to: route.paraswapAdapterAddress,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: 'sell',
        args: [
          payload.to,
          payload.data,
          market.collateralAsset.address as Address,
          market.loanAsset.address as Address,
          false,
          offsets,
          route.generalAdapterAddress,
        ],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
  ];
};
