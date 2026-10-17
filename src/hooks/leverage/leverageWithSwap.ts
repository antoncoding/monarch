import { type Address, encodeFunctionData, isAddressEqual, keccak256, maxUint256, zeroHash } from 'viem';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import morphoAbi from '@/abis/morpho';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import permit2Abi from '@/abis/permit2';
import { LEVERAGE_FEE_RECIPIENT } from '@/config/leverage';
import { MAX_SLIPPAGE_BPS } from '@/features/swap/constants';
import { getMorphoAddress, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { PERMIT2_ADDRESS } from '@/utils/permit2';
import type { Market } from '@/utils/types';
import { buildBundler3Erc20SweepCalls, type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets } from './bundler3';
import { getBorrowSharesSlippageAmount } from './math';
import {
  type EnsureBundlerAuthorization,
  type MorphoMarketParams,
  type LeverageStepType,
  type SendBundlerTransaction,
  type SignForBundlers,
  assertCanonicalSwapRoute,
  sleep,
} from './transaction-shared';
import type { SwapLeverageRoute } from './types';
import { assertTrustedVeloraExecutionTarget, buildVeloraBundlerTransactionPayload } from './velora-transaction';
import { computeMinSharePriceE27 } from './velora-precheck';
import { type ExecutableSwapQuote, isPendlePtLeveragePlan, isPendlePtSwapQuote } from './pendle';
import { buildPendleConversionCalls, getPendleSweepTokens } from './pendle-bundler';

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
  swapPriceRoute: ExecutableSwapQuote;
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
  if (!Number.isFinite(slippageBps) || slippageBps <= 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error('Invalid slippage tolerance. Please set a positive slippage value.');
  }
  assertCanonicalSwapRoute(market.morphoBlue.chain.id, bundlerAddress, route);

  const pendlePlan = isPendlePtLeveragePlan(swapPriceRoute) ? swapPriceRoute : null;
  const initialCollateralAmount = isLoanAssetInput ? BigInt(pendlePlan?.initialCapital?.minDestAmount ?? 0n) : initialCapitalTransferAmount;
  const preFlashCollateralFee =
    pendlePlan && totalCollateralTokenAmountAdded > 0n
      ? (leverageFeeAmount * initialCollateralAmount) / totalCollateralTokenAmountAdded
      : !isLoanAssetInput && initialCapitalTransferAmount > 0n
        ? leverageFeeAmount < initialCapitalTransferAmount
          ? leverageFeeAmount
          : initialCapitalTransferAmount
        : 0n;
  const callbackCollateralFee = leverageFeeAmount - preFlashCollateralFee;
  const preFlashCollateralSupplyAmount = initialCollateralAmount - preFlashCollateralFee;
  const totalLoanSellAmount = isLoanAssetInput ? initialCapitalTransferAmount + flashLoanAssetAmount : flashLoanAssetAmount;
  if (totalLoanSellAmount <= 0n) {
    throw new Error('Invalid total sell amount for swap-backed leverage.');
  }

  const collateralOutSlippageFloor = isLoanAssetInput ? totalCollateralTokenAmountAdded : flashLegCollateralTokenAmount;
  if (collateralOutSlippageFloor <= 0n) {
    throw new Error('The leverage route returned zero collateral output.');
  }
  const maxBorrowShares = getBorrowSharesSlippageAmount({
    borrowAssets: flashLoanAssetAmount,
    totalBorrowAssets: BigInt(market.state.borrowAssets),
    totalBorrowShares: BigInt(market.state.borrowShares),
  });
  const borrowMinSharePriceE27 = computeMinSharePriceE27(flashLoanAssetAmount, maxBorrowShares);
  if (borrowMinSharePriceE27 <= 0n) throw new Error('Invalid Morpho borrow share-price bound. Refresh the market and try again.');
  const callbackBundle: Bundler3Call[] = [];
  if (pendlePlan) {
    if (route.conversion !== 'pendle-pt') throw new Error('Pendle quote does not match the selected leverage route.');
    const plannedSource = BigInt(pendlePlan.initialCapital?.srcAmount ?? 0n) + BigInt(pendlePlan.flash.srcAmount);
    const plannedQuotedCollateral = BigInt(pendlePlan.initialCapital?.destAmount ?? 0n) + BigInt(pendlePlan.flash.destAmount);
    const plannedConvertedCollateral = BigInt(pendlePlan.initialCapital?.minDestAmount ?? 0n) + BigInt(pendlePlan.flash.minDestAmount);
    const plannedTotalCollateral = (isLoanAssetInput ? 0n : initialCapitalTransferAmount) + plannedConvertedCollateral;
    if (
      BigInt(pendlePlan.srcAmount) !== plannedSource ||
      plannedSource !== totalLoanSellAmount ||
      BigInt(pendlePlan.destAmount) !== plannedQuotedCollateral ||
      BigInt(pendlePlan.minDestAmount) !== plannedConvertedCollateral ||
      totalCollateralTokenAmountAdded !== plannedTotalCollateral ||
      flashLegCollateralTokenAmount !== BigInt(pendlePlan.flash.minDestAmount)
    ) {
      throw new Error('Pendle collateral output no longer matches the reviewed leverage quote.');
    }
    callbackBundle.push(
      ...(await buildPendleConversionCalls({
        bundlerAddress,
        direction: 'leverage',
        expectedAmountIn: flashLoanAssetAmount,
        market,
        quote: pendlePlan.flash,
        route,
        slippageBps,
      })),
    );
  } else if (route.conversion === 'pendle-pt' || isPendlePtSwapQuote(swapPriceRoute)) {
    throw new Error('Pendle leverage requires a phased conversion plan. Refresh the quote and try again.');
  } else {
    callbackBundle.push(
      ...(await buildGenericLeverageCalls({
        collateralOutSlippageFloor,
        market,
        route,
        slippageBps,
        swapPriceRoute,
        totalLoanSellAmount,
      })),
    );
  }

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
        args: [marketParams, flashLoanAssetAmount, 0n, borrowMinSharePriceE27, route.generalAdapterAddress],
      }),
      value: 0n,
      skipRevert: false,
      callbackHash: zeroHash,
    },
  );
  const callbackBundleData = encodeBundler3Calls(callbackBundle);
  // Match the audited reference flow: convert and supply wallet capital before
  // entering the flash loan; the callback contains only the borrowed debt leg.
  const initialPendleCalls = pendlePlan?.initialCapital
    ? await buildPendleConversionCalls({
        bundlerAddress,
        direction: 'leverage',
        expectedAmountIn: initialCapitalTransferAmount,
        market,
        quote: pendlePlan.initialCapital,
        route,
        slippageBps,
      })
    : [];
  if (pendlePlan && isLoanAssetInput && initialCapitalTransferAmount > 0n && initialPendleCalls.length === 0) {
    throw new Error('Pendle leverage is missing the initial-capital conversion. Refresh the quote and try again.');
  }

  // External routes are fully built above; only now create persistent permissions.
  const { authorizationCall, permit2Call } = await prepareLeverageAuthorization({
    account,
    approve,
    authorizePermit2,
    ensureBundlerAuthorization,
    isApproved,
    isBundlerAuthorized,
    initialCapitalInputTokenAddress,
    initialCapitalTransferAmount,
    market,
    permit2Authorized,
    signForBundlers,
    route,
    updateStep,
    usePermit2,
  });

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

    if (initialPendleCalls.length > 0) {
      bundleCalls.push(...initialPendleCalls);
    }

    if (!isLoanAssetInput || initialPendleCalls.length > 0) {
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
            args: [marketParams, initialPendleCalls.length > 0 ? maxUint256 : preFlashCollateralSupplyAmount, account, '0x'],
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
  const sweepTokenAddresses = pendlePlan
    ? getPendleSweepTokens(market, ...[pendlePlan.initialCapital, pendlePlan.flash].filter((quote) => quote !== null))
    : [market.loanAsset.address as Address, market.collateralAsset.address as Address];
  bundleCalls.push(
    ...buildBundler3Erc20SweepCalls({
      recipient: account,
      sweepTargets: [
        { adapterAbi: morphoGeneralAdapterV1Abi, adapterAddress: route.generalAdapterAddress },
        { adapterAbi: paraswapAdapterAbi, adapterAddress: route.paraswapAdapterAddress },
      ],
      tokenAddresses: sweepTokenAddresses,
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

type GenericSwapQuote = Exclude<ExecutableSwapQuote, { kind: 'pendle-pt' } | { kind: 'pendle-pt-leverage' }>;

const buildGenericLeverageCalls = async ({
  collateralOutSlippageFloor,
  market,
  route,
  slippageBps,
  swapPriceRoute,
  totalLoanSellAmount,
}: {
  collateralOutSlippageFloor: bigint;
  market: Market;
  route: SwapLeverageRoute;
  slippageBps: number;
  swapPriceRoute: GenericSwapQuote;
  totalLoanSellAmount: bigint;
}): Promise<Bundler3Call[]> => {
  const payload = await buildSwapTransactionPayload({ market, route, totalLoanSellAmount, swapPriceRoute, slippageBps });
  const error = 'Leverage quote changed. Please review the updated preview and try again.';
  assertTrustedVeloraExecutionTarget({ priceRoute: swapPriceRoute, quoteChangedMessage: error, transactionTarget: payload.to });
  const offsets = getParaswapSellOffsets({
    augustusCallData: payload.data,
    exactAmount: totalLoanSellAmount,
    limitAmount: collateralOutSlippageFloor,
  });
  return [
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
          payload.to,
          payload.data,
          market.loanAsset.address as Address,
          market.collateralAsset.address as Address,
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

type LeverageAuthorizationParams = Pick<
  LeverageWithSwapParams,
  | 'account'
  | 'approve'
  | 'authorizePermit2'
  | 'ensureBundlerAuthorization'
  | 'isApproved'
  | 'isBundlerAuthorized'
  | 'initialCapitalInputTokenAddress'
  | 'initialCapitalTransferAmount'
  | 'market'
  | 'permit2Authorized'
  | 'signForBundlers'
  | 'route'
  | 'updateStep'
  | 'usePermit2'
>;

const prepareLeverageAuthorization = async ({
  account,
  approve,
  authorizePermit2,
  ensureBundlerAuthorization,
  isApproved,
  isBundlerAuthorized,
  initialCapitalInputTokenAddress,
  initialCapitalTransferAmount,
  market,
  permit2Authorized,
  signForBundlers,
  route,
  updateStep,
  usePermit2,
}: LeverageAuthorizationParams): Promise<{ authorizationCall: Bundler3Call | null; permit2Call: Bundler3Call | null }> => {
  if (!usePermit2) {
    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_tx');
      const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
      if (!authorized) throw new Error('Failed to authorize Bundler via transaction.');
    }
    if (!isApproved) {
      updateStep('approve_token');
      await approve();
      await sleep(900);
    }
    return { authorizationCall: null, permit2Call: null };
  }

  if (!permit2Authorized) {
    updateStep('approve_permit2');
    await authorizePermit2();
    await sleep(800);
  }
  if (!isBundlerAuthorized) updateStep('authorize_bundler_sig');

  const { authorized, authorizationTxData, authorizationSignatureData } = await ensureBundlerAuthorization({ mode: 'signature' });
  if (!authorized) throw new Error('Failed to authorize Bundler via signature.');
  if (isBundlerAuthorized && authorizationTxData) throw new Error('Authorization state changed. Please retry leverage.');

  let authorizationCall: Bundler3Call | null = null;
  if (authorizationTxData) {
    if (!authorizationSignatureData) throw new Error('Missing Morpho authorization signature payload for swap-backed leverage.');
    const authorization = authorizationSignatureData.authorization;
    if (
      !isAddressEqual(authorization.authorizer, account) ||
      !isAddressEqual(authorization.authorized, route.generalAdapterAddress) ||
      !authorization.isAuthorized ||
      authorization.deadline <= BigInt(Math.floor(Date.now() / 1000))
    ) {
      throw new Error('Morpho authorization signature does not match this leverage transaction.');
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
  }

  updateStep('sign_permit');
  const { sigs, permitSingle } = await signForBundlers();
  if (
    !isAddressEqual(permitSingle.details.token, initialCapitalInputTokenAddress) ||
    !isAddressEqual(permitSingle.spender, route.generalAdapterAddress) ||
    permitSingle.details.amount !== initialCapitalTransferAmount ||
    permitSingle.sigDeadline <= BigInt(Math.floor(Date.now() / 1000))
  ) {
    throw new Error('Permit2 signature does not match this leverage transaction.');
  }
  const permit2Call: Bundler3Call = {
    to: PERMIT2_ADDRESS,
    data: encodeFunctionData({ abi: permit2Abi, functionName: 'permit', args: [account, permitSingle, sigs] }),
    value: 0n,
    skipRevert: false,
    callbackHash: zeroHash,
  };
  return { authorizationCall, permit2Call };
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
  swapPriceRoute: GenericSwapQuote;
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
