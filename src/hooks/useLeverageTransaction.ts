import { useCallback, useMemo } from 'react';
import { type Address, encodeAbiParameters, encodeFunctionData, keccak256, maxUint256, zeroHash } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import { buildVeloraTransactionPayload, isVeloraRateChangedError, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { DEFAULT_SLIPPAGE_PERCENT } from '@/features/swap/constants';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { usePermit2 } from '@/hooks/usePermit2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import type { Market } from '@/utils/types';
import { computeBorrowSharesWithBuffer, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

export type LeverageStepType =
  | 'approve_permit2'
  | 'authorize_bundler_sig'
  | 'sign_permit'
  | 'authorize_bundler_tx'
  | 'approve_token'
  | 'execute';

type UseLeverageTransactionProps = {
  market: Market;
  route: LeverageRoute | null;
  collateralAmount: bigint;
  collateralAmountInCollateralToken: bigint;
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint;
  swapPriceRoute: VeloraPriceRoute | null;
  useLoanAssetAsInput: boolean;
  onSuccess?: () => void;
};

const LEVERAGE_SWAP_SLIPPAGE_BPS = Math.round(DEFAULT_SLIPPAGE_PERCENT * 100);
const PARASWAP_SWAP_EXACT_AMOUNT_IN_SELECTOR = '0xe3ead59e';
const PARASWAP_SELL_EXACT_AMOUNT_OFFSET = 100n;
const PARASWAP_SELL_MIN_DEST_AMOUNT_OFFSET = 132n;
const PARASWAP_SELL_QUOTED_DEST_AMOUNT_OFFSET = 164n;

type Bundler3Call = {
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

const encodeBundler3Calls = (bundle: Bundler3Call[]): `0x${string}` => {
  return encodeAbiParameters(BUNDLER3_CALLS_ABI_PARAMS, [bundle]);
};

const getParaswapSellOffsets = (augustusCallData: `0x${string}`) => {
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

const readCalldataUint256 = (callData: `0x${string}`, offset: bigint): bigint => {
  const byteOffset = Number(offset);
  const start = 2 + byteOffset * 2;
  const end = start + 64;
  if (callData.length < end) {
    throw new Error('Invalid Paraswap calldata for swap-backed leverage.');
  }

  return BigInt(`0x${callData.slice(start, end)}`);
};

/**
 * Executes leverage transactions for:
 * - ERC4626 deterministic loops on Bundler V2
 * - generalized swap-backed loops on Bundler3 + adapters
 */
export function useLeverageTransaction({
  market,
  route,
  collateralAmount,
  collateralAmountInCollateralToken,
  flashCollateralAmount,
  flashLoanAmount,
  swapPriceRoute,
  useLoanAssetAsInput,
  onSuccess,
}: UseLeverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('leverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const isSwapRoute = route?.kind === 'swap';
  const usePermit2ForRoute = usePermit2Setting && !isSwapRoute;
  
  const bundlerAddress = useMemo<Address>(() => {
    if (route?.kind === 'swap') {
      return route.bundler3Address;
    }
    return getBundlerV2(market.morphoBlue.chain.id) as Address;
  }, [route, market.morphoBlue.chain.id]);
  const authorizationTarget = useMemo<Address>(() => {
    if (route?.kind === 'swap') {
      return route.generalAdapterAddress;
    }
    return bundlerAddress;
  }, [route, bundlerAddress]);
  
  const { batchAddUserMarkets } = useUserMarketsCache(account);
  const isLoanAssetInput = !isSwapRoute && useLoanAssetAsInput;
  const inputTokenAddress = isLoanAssetInput ? (market.loanAsset.address as Address) : (market.collateralAsset.address as Address);
  const inputTokenSymbol = isLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputTokenDecimals = isLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputTokenAmountForTransfer = isLoanAssetInput ? collateralAmount : collateralAmountInCollateralToken;
  const approvalSpender = route?.kind === 'swap' ? route.generalAdapterAddress : bundlerAddress;

  const { isBundlerAuthorized, isAuthorizingBundler, ensureBundlerAuthorization, refetchIsBundlerAuthorized } = useBundlerAuthorizationStep(
    {
      chainId: market.morphoBlue.chain.id,
      bundlerAddress: authorizationTarget,
    },
  );

  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: approvalSpender,
    token: inputTokenAddress as `0x${string}`,
    refetchInterval: 10_000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: inputTokenSymbol,
    amount: usePermit2ForRoute ? inputTokenAmountForTransfer : 0n,
  });

  const { isApproved, approve, isApproving } = useERC20Approval({
    token: inputTokenAddress,
    spender: approvalSpender,
    amount: inputTokenAmountForTransfer,
    tokenSymbol: inputTokenSymbol,
    chainId: market.morphoBlue.chain.id,
  });

  const { isConfirming: leveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'leverage',
    pendingText: `Leveraging ${formatBalance(collateralAmount, inputTokenDecimals)} ${inputTokenSymbol}`,
    successText: 'Leverage Executed',
    errorText: 'Failed to execute leverage',
    chainId,
    pendingDescription: `Executing leverage on market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: 'Position levered successfully',
    onSuccess: () => {
      void refetchIsBundlerAuthorized();
      if (onSuccess) void onSuccess();
    },
  });

  const getStepsForFlow = useCallback(
    (isPermit2: boolean, isSwap: boolean) => {
      if (isSwap) {
        return [
          {
            id: 'authorize_bundler_tx',
            title: 'Authorize Morpho Adapter',
            description: 'Submit one transaction authorizing Morpho adapter actions on your position.',
          },
          {
            id: 'approve_token',
            title: `Approve ${inputTokenSymbol}`,
            description: `Approve ${inputTokenSymbol} transfer for the leverage flow.`,
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the Bundler3 leverage transaction in your wallet.',
          },
        ];
      }

      if (isPermit2) {
        return [
          {
            id: 'approve_permit2',
            title: 'Authorize Permit2',
            description: "One-time approval so future leverage transactions don't need token approvals.",
          },
          {
            id: 'authorize_bundler_sig',
            title: 'Authorize Morpho Bundler',
            description: 'Sign a message to authorize the bundler for Morpho actions.',
          },
          {
            id: 'sign_permit',
            title: 'Sign Token Permit',
            description: 'Sign Permit2 transfer authorization for collateral transfer.',
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the leverage transaction in your wallet.',
          },
        ];
      }

      return [
        {
          id: 'authorize_bundler_tx',
          title: 'Authorize Morpho Bundler',
          description: 'Submit one transaction authorizing bundler actions on your Morpho position.',
        },
        {
          id: 'approve_token',
          title: `Approve ${inputTokenSymbol}`,
          description: `Approve ${inputTokenSymbol} transfer for the leverage flow.`,
        },
        {
          id: 'execute',
          title: 'Confirm Leverage',
          description: 'Confirm the leverage transaction in your wallet.',
        },
      ];
    },
    [inputTokenSymbol],
  );

  const executeLeverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    if (!route) {
      toast.info('Unsupported route', 'This market is not supported for leverage.');
      return;
    }

    if (collateralAmount <= 0n || flashLoanAmount <= 0n || flashCollateralAmount <= 0n) {
      toast.info('Invalid leverage inputs', 'Set collateral and multiplier above 1x before submitting.');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];

      if (usePermit2ForRoute) {
        if (!permit2Authorized) {
          tracking.update('approve_permit2');
          await authorizePermit2();
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        if (!isBundlerAuthorized) {
          tracking.update('authorize_bundler_sig');
        }
        const { authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (authorizationTxData) {
          txs.push(authorizationTxData);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('sign_permit');
        const { sigs, permitSingle } = await signForBundlers();
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'approve2',
            args: [permitSingle, sigs, false],
          }),
        );
      } else {
        tracking.update('authorize_bundler_tx');
        const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via transaction.');
        }

        tracking.update('approve_token');
        if (!isApproved) {
          await approve();
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      if (route.kind === 'swap') {
        if (!swapPriceRoute) {
          throw new Error('Missing Velora swap quote for leverage.');
        }

        const activePriceRoute = swapPriceRoute;
        const swapTxPayload = await (async () => {
          try {
            return await buildVeloraTransactionPayload({
              srcToken: market.loanAsset.address,
              srcDecimals: market.loanAsset.decimals,
              destToken: market.collateralAsset.address,
              destDecimals: market.collateralAsset.decimals,
              srcAmount: flashLoanAmount,
              network: market.morphoBlue.chain.id,
              userAddress: account as Address,
              priceRoute: activePriceRoute,
              slippageBps: LEVERAGE_SWAP_SLIPPAGE_BPS,
              side: 'SELL',
            });
          } catch (buildError: unknown) {
            if (isVeloraRateChangedError(buildError)) {
              throw new Error('Leverage quote changed. Please review the updated preview and try again.');
            }
            throw buildError;
          }
        })();

        const minCollateralOut = withSlippageFloor(BigInt(activePriceRoute.destAmount));
        if (minCollateralOut <= 0n) {
          throw new Error('Velora returned zero collateral output for leverage swap.');
        }

        const sellOffsets = getParaswapSellOffsets(swapTxPayload.data);
        const quotedBorrowAssets = BigInt(activePriceRoute.srcAmount);
        const calldataSellAmount = readCalldataUint256(swapTxPayload.data, sellOffsets.exactAmount);
        const calldataMinCollateralOut = readCalldataUint256(swapTxPayload.data, sellOffsets.limitAmount);
        if (quotedBorrowAssets !== flashLoanAmount || calldataSellAmount !== flashLoanAmount || calldataMinCollateralOut !== minCollateralOut) {
          throw new Error('Leverage quote changed. Please review the updated preview and try again.');
        }

        const callbackBundle: Bundler3Call[] = [
          {
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'erc20Transfer',
              args: [market.loanAsset.address as Address, route.paraswapAdapterAddress, flashLoanAmount],
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
          {
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'morphoSupplyCollateral',
              args: [marketParams, maxUint256, account as Address, '0x'],
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
              args: [marketParams, flashLoanAmount, 0n, 0n, route.generalAdapterAddress],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          },
        ];
        const callbackBundleData = encodeBundler3Calls(callbackBundle);

        const bundleCalls: Bundler3Call[] = [];

        if (inputTokenAmountForTransfer > 0n) {
          bundleCalls.push({
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'erc20TransferFrom',
              args: [inputTokenAddress, route.generalAdapterAddress, inputTokenAmountForTransfer],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          });
          bundleCalls.push({
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'morphoSupplyCollateral',
              args: [marketParams, inputTokenAmountForTransfer, account as Address, '0x'],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          });
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

        tracking.update('execute');
        await new Promise((resolve) => setTimeout(resolve, 800));

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
      } else {
        const maxBorrowShares = computeBorrowSharesWithBuffer({
          borrowAssets: flashLoanAmount,
          totalBorrowAssets: BigInt(market.state.borrowAssets),
          totalBorrowShares: BigInt(market.state.borrowShares),
        });

        if (inputTokenAmountForTransfer > 0n) {
          txs.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: usePermit2ForRoute ? 'transferFrom2' : 'erc20TransferFrom',
              args: [inputTokenAddress, inputTokenAmountForTransfer],
            }),
          );
        }

        if (isLoanAssetInput) {
          // WHY: this lets users start with loan-token underlying for ERC4626 markets.
          // We mint shares first so all leverage math and downstream Morpho collateral is in share units.
          txs.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'erc4626Deposit',
              args: [
                route.collateralVault,
                collateralAmount,
                withSlippageFloor(collateralAmountInCollateralToken),
                bundlerAddress as Address,
              ],
            }),
          );
        }

        const callbackTxs: `0x${string}`[] = [
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc4626Deposit',
            args: [route.collateralVault, flashLoanAmount, withSlippageFloor(flashCollateralAmount), bundlerAddress as Address],
          }),
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoSupplyCollateral',
            args: [marketParams, maxUint256, account as Address, '0x'],
          }),
        ];

        callbackTxs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoBorrow',
            args: [marketParams, flashLoanAmount, 0n, maxBorrowShares, bundlerAddress as Address],
          }),
        );

        const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoFlashLoan',
            args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
          }),
        );

        tracking.update('execute');
        await new Promise((resolve) => setTimeout(resolve, 800));

        await sendTransactionAsync({
          account,
          to: bundlerAddress,
          data: (encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'multicall',
            args: [txs],
          }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
          value: 0n,
        });
      }

      batchAddUserMarkets([
        {
          marketUniqueKey: market.uniqueKey,
          chainId: market.morphoBlue.chain.id,
        },
      ]);

      tracking.complete();
    } catch (error: unknown) {
      tracking.fail();
      console.error('Error during leverage execution:', error);
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'An unexpected error occurred during leverage.');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Leverage Failed', userFacingMessage);
      }
    }
  }, [
    account,
    market,
    route,
    collateralAmount,
    collateralAmountInCollateralToken,
    inputTokenAmountForTransfer,
    inputTokenAddress,
    isLoanAssetInput,
    flashCollateralAmount,
    flashLoanAmount,
    swapPriceRoute,
    usePermit2ForRoute,
    permit2Authorized,
    isBundlerAuthorized,
    authorizePermit2,
    ensureBundlerAuthorization,
    signForBundlers,
    isApproved,
    approve,
    bundlerAddress,
    sendTransactionAsync,
    batchAddUserMarkets,
    tracking,
    toast,
  ]);

  const approveAndLeverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    try {
      const initialStep = usePermit2ForRoute ? 'approve_permit2' : 'authorize_bundler_tx';
      tracking.start(
        getStepsForFlow(usePermit2ForRoute, isSwapRoute),
        {
          title: 'Leverage',
          description: `${market.collateralAsset.symbol} leveraged using ${market.loanAsset.symbol} debt`,
          tokenSymbol: inputTokenSymbol,
          amount: collateralAmount,
          marketId: market.uniqueKey,
        },
        initialStep,
      );

      await executeLeverage();
    } catch (error: unknown) {
      console.error('Error in approveAndLeverage:', error);
      tracking.fail();
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process leverage transaction');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Error', userFacingMessage);
      }
    }
  }, [account, usePermit2ForRoute, tracking, getStepsForFlow, isSwapRoute, market, inputTokenSymbol, collateralAmount, executeLeverage, toast]);

  const signAndLeverage = useCallback(async () => {
    if (!usePermit2ForRoute) {
      await approveAndLeverage();
      return;
    }

    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }

    try {
      const initialStep: LeverageStepType = permit2Authorized
        ? isBundlerAuthorized
          ? 'sign_permit'
          : 'authorize_bundler_sig'
        : 'approve_permit2';

      tracking.start(
        getStepsForFlow(true, false),
        {
          title: 'Leverage',
          description: `${market.collateralAsset.symbol} leveraged using ${market.loanAsset.symbol} debt`,
          tokenSymbol: inputTokenSymbol,
          amount: collateralAmount,
          marketId: market.uniqueKey,
        },
        initialStep,
      );

      await executeLeverage();
    } catch (error: unknown) {
      console.error('Error in signAndLeverage:', error);
      tracking.fail();
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process leverage transaction');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Transaction Error', userFacingMessage);
      }
    }
  }, [
    usePermit2ForRoute,
    approveAndLeverage,
    account,
    tracking,
    getStepsForFlow,
    permit2Authorized,
    isBundlerAuthorized,
    market,
    inputTokenSymbol,
    collateralAmount,
    executeLeverage,
    toast,
  ]);

  const isLoading = leveragePending || (usePermit2ForRoute && isLoadingPermit2) || isApproving || isAuthorizingBundler;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as LeverageStepType | null,
    isLoadingPermit2: usePermit2ForRoute ? isLoadingPermit2 : false,
    isApproved,
    permit2Authorized: usePermit2ForRoute ? permit2Authorized : false,
    leveragePending,
    isLoading,
    isBundlerAuthorized,
    approveAndLeverage,
    signAndLeverage,
  };
}
