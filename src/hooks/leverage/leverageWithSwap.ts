import { type Address, encodeFunctionData, isAddress, isAddressEqual, keccak256, maxUint256, zeroHash } from 'viem';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import morphoAbi from '@/abis/morpho';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import permit2Abi from '@/abis/permit2';
import { LEVERAGE_FEE_RECIPIENT } from '@/config/leverage';
import { buildVeloraTransactionPayload, isVeloraRateChangedError, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { getMorphoAddress, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { PERMIT2_ADDRESS } from '@/utils/permit2';
import type { Market } from '@/utils/types';
import { type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets, readCalldataUint256 } from './bundler3';
import {
  type EnsureLeverageAuthorization,
  type LeverageMarketParams,
  type LeverageStepType,
  type SendLeverageTransaction,
  type SignForLeverageBundlers,
  sleep,
} from './transaction-shared';
import type { SwapLeverageRoute } from './types';
import { isVeloraBypassablePrecheckError } from './velora-precheck';

type LeverageWithSwapParams = {
  account: Address;
  bundlerAddress: Address;
  market: Market;
  marketParams: LeverageMarketParams;
  route: SwapLeverageRoute;
  inputTokenAddress: Address;
  inputTokenAmountForTransfer: bigint;
  isLoanAssetInput: boolean;
  flashLoanAmount: bigint;
  flashCollateralAmount: bigint;
  totalAddedCollateral: bigint;
  leverageFeeAmount: bigint;
  swapPriceRoute: VeloraPriceRoute;
  slippageBps: number;
  usePermit2: boolean;
  permit2Authorized: boolean;
  isBundlerAuthorized: boolean | undefined;
  authorizePermit2: () => Promise<unknown>;
  ensureBundlerAuthorization: EnsureLeverageAuthorization;
  signForBundlers: SignForLeverageBundlers;
  isApproved: boolean;
  approve: () => Promise<unknown>;
  updateStep: (step: LeverageStepType) => void;
  sendTransactionAsync: SendLeverageTransaction;
};

const buildSwapTransactionPayload = async ({
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
}) => {
  const buildPayload = async (ignoreChecks: boolean) =>
    buildVeloraTransactionPayload({
      srcToken: market.loanAsset.address,
      srcDecimals: market.loanAsset.decimals,
      destToken: market.collateralAsset.address,
      destDecimals: market.collateralAsset.decimals,
      srcAmount: totalLoanSellAmount,
      network: market.morphoBlue.chain.id,
      userAddress: route.paraswapAdapterAddress,
      priceRoute: swapPriceRoute,
      slippageBps,
      ignoreChecks,
    });

  try {
    return await buildPayload(false);
  } catch (buildError: unknown) {
    if (isVeloraRateChangedError(buildError)) {
      throw new Error('Leverage quote changed. Please review the updated preview and try again.');
    }

    if (
      !isVeloraBypassablePrecheckError({
        error: buildError,
        sourceTokenAddress: market.loanAsset.address,
        sourceTokenSymbol: market.loanAsset.symbol,
      })
    ) {
      throw buildError;
    }

    try {
      return await buildPayload(true);
    } catch (fallbackBuildError: unknown) {
      if (isVeloraRateChangedError(fallbackBuildError)) {
        throw new Error('Leverage quote changed. Please review the updated preview and try again.');
      }

      throw fallbackBuildError;
    }
  }
};

export const leverageWithSwap = async ({
  account,
  bundlerAddress,
  market,
  marketParams,
  route,
  inputTokenAddress,
  inputTokenAmountForTransfer,
  isLoanAssetInput,
  flashLoanAmount,
  flashCollateralAmount,
  totalAddedCollateral,
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
    !isLoanAssetInput && inputTokenAmountForTransfer > 0n
      ? leverageFeeAmount < inputTokenAmountForTransfer
        ? leverageFeeAmount
        : inputTokenAmountForTransfer
      : 0n;
  const callbackCollateralFee = leverageFeeAmount - preFlashCollateralFee;
  const preFlashCollateralSupplyAmount = inputTokenAmountForTransfer - preFlashCollateralFee;
  const totalLoanSellAmount = isLoanAssetInput ? inputTokenAmountForTransfer + flashLoanAmount : flashLoanAmount;
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

  const trustedVeloraTargets = [swapPriceRoute.contractAddress, swapPriceRoute.tokenTransferProxy].filter(
    (candidate): candidate is Address => typeof candidate === 'string' && isAddress(candidate),
  );
  if (trustedVeloraTargets.length === 0 || !trustedVeloraTargets.some((target) => isAddressEqual(swapTxPayload.to, target))) {
    throw new Error('Leverage quote changed. Please review the updated preview and try again.');
  }

  const expectedCollateralOut = isLoanAssetInput ? totalAddedCollateral : flashCollateralAmount;
  if (expectedCollateralOut <= 0n) {
    throw new Error('Velora returned zero collateral output for leverage swap.');
  }

  const sellOffsets = getParaswapSellOffsets(swapTxPayload.data);
  const quotedSellAmount = BigInt(swapPriceRoute.srcAmount);
  const calldataSellAmount = readCalldataUint256(swapTxPayload.data, sellOffsets.exactAmount);
  const calldataMinCollateralOut = readCalldataUint256(swapTxPayload.data, sellOffsets.limitAmount);
  if (
    quotedSellAmount !== totalLoanSellAmount ||
    calldataSellAmount !== totalLoanSellAmount ||
    calldataMinCollateralOut !== expectedCollateralOut
  ) {
    throw new Error('Leverage quote changed. Please review the updated preview and try again.');
  }

  const callbackBundle: Bundler3Call[] = [
    // put asset into parapswap adapter for swapping.
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
        args: [marketParams, flashLoanAmount, 0n, 0n, route.generalAdapterAddress],
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

  if (inputTokenAmountForTransfer > 0n) {
    bundleCalls.push({
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: usePermit2 ? 'permit2TransferFrom' : 'erc20TransferFrom',
        args: [inputTokenAddress, route.generalAdapterAddress, inputTokenAmountForTransfer],
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
      args: [market.loanAsset.address as Address, flashLoanAmount, callbackBundleData],
    }),
    value: 0n,
    skipRevert: false,
    callbackHash: keccak256(callbackBundleData),
  });
  // Safety net: sweep any residual loan/collateral balances from adapters to the user.
  bundleCalls.push(
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'erc20Transfer',
        args: [market.loanAsset.address as Address, account, maxUint256],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.generalAdapterAddress,
      data: encodeFunctionData({
        abi: morphoGeneralAdapterV1Abi,
        functionName: 'erc20Transfer',
        args: [market.collateralAsset.address as Address, account, maxUint256],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.paraswapAdapterAddress,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: 'erc20Transfer',
        args: [market.loanAsset.address as Address, account, maxUint256],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
    {
      to: route.paraswapAdapterAddress,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: 'erc20Transfer',
        args: [market.collateralAsset.address as Address, account, maxUint256],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
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
