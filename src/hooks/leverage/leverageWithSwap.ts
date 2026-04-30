import { type Address, encodeFunctionData, keccak256, maxUint256, zeroHash } from 'viem';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import morphoAbi from '@/abis/morpho';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import permit2Abi from '@/abis/permit2';
import { LEVERAGE_FEE_RECIPIENT } from '@/config/leverage';
import type { VeloraPriceRoute } from '@/features/swap/api/velora';
import { getMorphoAddress, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { PERMIT2_ADDRESS } from '@/utils/permit2';
import type { Market } from '@/utils/types';
import { buildBundler3Erc20SweepCalls, type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets } from './bundler3';
import {
  type EnsureBundlerAuthorization,
  type MorphoMarketParams,
  type LeverageStepType,
  type SendBundlerTransaction,
  type SignForBundlers,
  sleep,
} from './transaction-shared';
import type { SwapLeverageRoute } from './types';
import { assertTrustedVeloraExecutionTarget, buildVeloraBundlerTransactionPayload } from './velora-transaction';

type LeverageWithSwapParams = {
  account: Address;
  bundlerAddress: Address;
  market: Market;
  marketParams: MorphoMarketParams;
  route: SwapLeverageRoute;
  initialCapitalInputTokenAddress: Address;
  initialCapitalTransferAmount: bigint;
  isLoanAssetInput: boolean;
  flashLoanAssetAmount: bigint;
  flashLegCollateralTokenAmount: bigint;
  totalCollateralTokenAmountAdded: bigint;
  leverageFeeAmount: bigint;
  swapPriceRoute: VeloraPriceRoute;
  slippageBps: number;
  usePermit2: boolean;
  permit2Authorized: boolean;
  isBundlerAuthorized: boolean | undefined;
  authorizePermit2: () => Promise<unknown>;
  ensureBundlerAuthorization: EnsureBundlerAuthorization;
  signForBundlers: SignForBundlers;
  isApproved: boolean;
  approve: () => Promise<unknown>;
  updateStep: (step: LeverageStepType) => void;
  sendTransactionAsync: SendBundlerTransaction;
};

export const leverageWithSwap = async ({
  account,
  bundlerAddress,
  market,
  marketParams,
  route,
  initialCapitalInputTokenAddress,
  initialCapitalTransferAmount,
  isLoanAssetInput,
  flashLoanAssetAmount,
  flashLegCollateralTokenAmount,
  totalCollateralTokenAmountAdded,
  leverageFeeAmount,
  swapPriceRoute,
  slippageBps,
  usePermit2,
  permit2Authorized,
  isBundlerAuthorized,
  authorizePermit2,
  ensureBundlerAuthorization,
  signForBundlers,
  isApproved,
  approve,
  updateStep,
  sendTransactionAsync,
}: LeverageWithSwapParams): Promise<void> => {
  if (!Number.isFinite(slippageBps) || slippageBps <= 0) {
    throw new Error('Invalid slippage tolerance. Please set a positive slippage value.');
  }

  const preFlashCollateralFee =
    !isLoanAssetInput && initialCapitalTransferAmount > 0n
      ? leverageFeeAmount < initialCapitalTransferAmount
        ? leverageFeeAmount
        : initialCapitalTransferAmount
      : 0n;
  const callbackCollateralFee = leverageFeeAmount - preFlashCollateralFee;
  const preFlashCollateralSupplyAmount = initialCapitalTransferAmount - preFlashCollateralFee;
  const totalLoanSellAmount = isLoanAssetInput ? initialCapitalTransferAmount + flashLoanAssetAmount : flashLoanAssetAmount;
  if (totalLoanSellAmount <= 0n) {
    throw new Error('Invalid total sell amount for swap-backed leverage.');
  }

  let authorizationCall: Bundler3Call | null = null;
  let permit2Call: Bundler3Call | null = null;

  if (usePermit2) {
    if (!permit2Authorized) {
      updateStep('approve_permit2');
      await authorizePermit2();
      await sleep(800);
    }

    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_sig');
    }

    const { authorized, authorizationTxData, authorizationSignatureData } = await ensureBundlerAuthorization({ mode: 'signature' });
    if (!authorized) {
      throw new Error('Failed to authorize Bundler via signature.');
    }
    if (isBundlerAuthorized && authorizationTxData) {
      throw new Error('Authorization state changed. Please retry leverage.');
    }
    if (authorizationTxData) {
      if (!authorizationSignatureData) {
        throw new Error('Missing Morpho authorization signature payload for swap-backed leverage.');
      }

      authorizationCall = {
        to: getMorphoAddress(market.morphoBlue.chain.id) as Address,
        data: encodeFunctionData({
          abi: morphoAbi,
          functionName: 'setAuthorizationWithSig',
          args: [authorizationSignatureData.authorization, authorizationSignatureData.signature],
        }),
        value: 0n,
        skipRevert: false,
        callbackHash: zeroHash,
      };
      await sleep(800);
    }

    updateStep('sign_permit');
    const { sigs, permitSingle } = await signForBundlers();
    permit2Call = {
      to: PERMIT2_ADDRESS,
      data: encodeFunctionData({
        abi: permit2Abi,
        functionName: 'permit',
        args: [account, permitSingle, sigs],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    };
  } else {
    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_tx');
      const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
      if (!authorized) {
        throw new Error('Failed to authorize Bundler via transaction.');
      }
    }

    if (!isApproved) {
      updateStep('approve_token');
      await approve();
      await sleep(900);
    }
  }

  const swapTxPayload = await buildSwapTransactionPayload({
    market,
    route,
    totalLoanSellAmount,
    swapPriceRoute,
    slippageBps,
  });
  assertTrustedVeloraExecutionTarget({
    priceRoute: swapPriceRoute,
    quoteChangedMessage: 'Leverage quote changed. Please review the updated preview and try again.',
    transactionTarget: swapTxPayload.to,
  });

  const collateralOutSlippageFloor = isLoanAssetInput ? totalCollateralTokenAmountAdded : flashLegCollateralTokenAmount;
  if (collateralOutSlippageFloor <= 0n) {
    throw new Error('Velora returned zero collateral output for leverage swap.');
  }

  const sellOffsets = getParaswapSellOffsets({
    augustusCallData: swapTxPayload.data,
    exactAmount: totalLoanSellAmount,
    limitAmount: collateralOutSlippageFloor,
  });

  const callbackBundle: Bundler3Call[] = [
    // Move the sold loan asset into the Paraswap adapter, which is the contract that actually executes the swap.
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'erc20Transfer',
        args: [market.loanAsset.address as Address, route.paraswapAdapterAddress, totalLoanSellAmount],
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
          market.loanAsset.address as Address,
          market.collateralAsset.address as Address,
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

  if (callbackCollateralFee > 0n) {
    callbackBundle.push({
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'erc20Transfer',
        args: [market.collateralAsset.address as Address, LEVERAGE_FEE_RECIPIENT, callbackCollateralFee],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    });
  }

  callbackBundle.push(
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoSupplyCollateral',
        args: [marketParams, maxUint256, account, '0x'],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'morphoBorrow',
        // receive the flashloan in general adapter address
        args: [marketParams, flashLoanAssetAmount, 0n, 0n, route.generalAdapterAddress],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
  );
  const callbackBundleData = encodeBundler3Calls(callbackBundle);

  const bundleCalls: Bundler3Call[] = [];
  if (authorizationCall) {
    bundleCalls.push(authorizationCall);
  }
  if (permit2Call) {
    bundleCalls.push(permit2Call);
  }

  if (initialCapitalTransferAmount > 0n) {
    bundleCalls.push({
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: usePermit2 ? 'permit2TransferFrom' : 'erc20TransferFrom',
        args: [initialCapitalInputTokenAddress, route.generalAdapterAddress, initialCapitalTransferAmount],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    });

    if (!isLoanAssetInput) {
      if (preFlashCollateralFee > 0n) {
        bundleCalls.push({
          to: route.generalAdapterAddress,
          data: encodeFunctionData({
            abi: morphoGeneralAdapterV1Abi,
            functionName: 'erc20Transfer',
            args: [market.collateralAsset.address as Address, LEVERAGE_FEE_RECIPIENT, preFlashCollateralFee],
          }),
          value: 0n,
          skipRevert: false,
          callbackHash: zeroHash,
        });
      }
      if (preFlashCollateralSupplyAmount > 0n) {
        bundleCalls.push({
          to: route.generalAdapterAddress,
          data: encodeFunctionData({
            abi: morphoGeneralAdapterV1Abi,
            functionName: 'morphoSupplyCollateral',
            args: [marketParams, preFlashCollateralSupplyAmount, account, '0x'],
          }),
          value: 0n,
          skipRevert: false,
          callbackHash: zeroHash,
        });
      }
    }
  }

  bundleCalls.push({
    to: route.generalAdapterAddress,
    data: encodeFunctionData({
      abi: morphoGeneralAdapterV1Abi,
      functionName: 'morphoFlashLoan',
      args: [market.loanAsset.address as Address, flashLoanAssetAmount, callbackBundleData],
    }),
    value: 0n,
    skipRevert: false,
    callbackHash: keccak256(callbackBundleData),
  });
  // Safety net: sweep both assets from every adapter touched by the swap route.
  bundleCalls.push(
    ...buildBundler3Erc20SweepCalls({
      recipient: account,
      sweepTargets: [
        { adapterAbi: morphoGeneralAdapterV1Abi, adapterAddress: route.generalAdapterAddress },
        { adapterAbi: paraswapAdapterAbi, adapterAddress: route.paraswapAdapterAddress },
      ],
      tokenAddresses: [market.loanAsset.address as Address, market.collateralAsset.address as Address],
    }),
  );

  updateStep('execute');
  await sleep(800);

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

const buildSwapTransactionPayload = ({
  market,
  route,
  totalLoanSellAmount,
  swapPriceRoute,
  slippageBps,
}: {
  market: Market;
  route: SwapLeverageRoute;
  totalLoanSellAmount: bigint;
  swapPriceRoute: VeloraPriceRoute;
  slippageBps: number;
}) =>
  buildVeloraBundlerTransactionPayload({
    destinationTokenAddress: market.collateralAsset.address,
    destinationTokenDecimals: market.collateralAsset.decimals,
    executionAddress: route.paraswapAdapterAddress,
    network: market.morphoBlue.chain.id,
    priceRoute: swapPriceRoute,
    quoteChangedMessage: 'Leverage quote changed. Please review the updated preview and try again.',
    slippageBps,
    sourceTokenAddress: market.loanAsset.address,
    sourceTokenAmount: totalLoanSellAmount,
    sourceTokenDecimals: market.loanAsset.decimals,
    sourceTokenSymbol: market.loanAsset.symbol,
  });
