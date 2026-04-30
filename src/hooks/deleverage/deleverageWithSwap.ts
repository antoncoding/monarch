import { type Address, encodeFunctionData, keccak256, zeroHash } from 'viem';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import type { VeloraPriceRoute } from '@/features/swap/api/velora';
import { buildBundler3Erc20SweepCalls, type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets } from '@/hooks/leverage/bundler3';
import { withSlippageFloor } from '@/hooks/leverage/math';
import {
  type EnsureBundlerAuthorization,
  type MorphoMarketParams,
  type SendBundlerTransaction,
  sleep,
} from '@/hooks/leverage/transaction-shared';
import type { SwapLeverageRoute } from '@/hooks/leverage/types';
import { assertTrustedVeloraExecutionTarget, buildVeloraBundlerTransactionPayload } from '@/hooks/leverage/velora-transaction';
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
  swapSellPriceRoute: VeloraPriceRoute;
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
  if (!Number.isFinite(slippageBps) || slippageBps <= 0) {
    throw new Error('Invalid slippage tolerance. Please set a positive slippage value.');
  }

  if (!isBundlerAuthorized) {
    updateStep('authorize_bundler_tx');
    const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
    if (!authorized) {
      throw new Error('Failed to authorize Bundler via transaction.');
    }
  }

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
    useRepayByShares: useCloseRoute,
  });

  const swapTxPayload = await buildVeloraBundlerTransactionPayload({
    destinationTokenAddress: market.loanAsset.address,
    destinationTokenDecimals: market.loanAsset.decimals,
    executionAddress: route.paraswapAdapterAddress,
    network: market.morphoBlue.chain.id,
    priceRoute: swapSellPriceRoute,
    quoteChangedMessage: 'Deleverage quote changed. Please review the updated preview and try again.',
    slippageBps,
    sourceTokenAddress: market.collateralAsset.address,
    sourceTokenAmount: withdrawCollateralAmount,
    sourceTokenDecimals: market.collateralAsset.decimals,
    sourceTokenSymbol: market.collateralAsset.symbol,
  });

  assertTrustedVeloraExecutionTarget({
    priceRoute: swapSellPriceRoute,
    quoteChangedMessage: 'Deleverage quote changed. Please review the updated preview and try again.',
    transactionTarget: swapTxPayload.to,
  });

  const quotedLoanAssetsOut = BigInt(swapSellPriceRoute.destAmount);
  const loanAssetsOutSlippageFloor = withSlippageFloor(quotedLoanAssetsOut, slippageBps);
  if (useCloseRoute) {
    if (loanAssetsOutSlippageFloor < flashLoanAmount) {
      throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
    }
  } else if (loanAssetsOutSlippageFloor <= 0n) {
    throw new Error('Velora returned zero loan output for deleverage swap.');
  }

  const sellOffsets = getParaswapSellOffsets({
    augustusCallData: swapTxPayload.data,
    exactAmount: withdrawCollateralAmount,
    limitAmount: loanAssetsOutSlippageFloor,
  });

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
        // Withdraw collateral straight into the Paraswap adapter because that contract executes the sell leg.
        args: [marketParams, withdrawCollateralAmount, route.paraswapAdapterAddress],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.paraswapAdapterAddress,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: 'sell',
        args: [
          swapTxPayload.to,
          swapTxPayload.data,
          market.collateralAsset.address as Address,
          market.loanAsset.address as Address,
          false,
          sellOffsets,
          route.generalAdapterAddress,
        ],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
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
      tokenAddresses: [market.loanAsset.address as Address, market.collateralAsset.address as Address],
    }),
  ];

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
