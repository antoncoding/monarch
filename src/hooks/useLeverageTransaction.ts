import { useCallback, useMemo } from 'react';
import { type Address, encodeAbiParameters, encodeFunctionData, isAddress, isAddressEqual, keccak256, maxUint256, zeroHash } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import morphoAbi from '@/abis/morpho';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import permit2Abi from '@/abis/permit2';
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
import { getBundlerV2, getMorphoAddress, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { PERMIT2_ADDRESS } from '@/utils/permit2';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import type { Market } from '@/utils/types';
import { type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets, readCalldataUint256 } from './leverage/bundler3';
import { computeBorrowSharesWithBuffer, withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';
import { isVeloraBypassablePrecheckError } from './leverage/velora-precheck';

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
  totalAddedCollateral: bigint;
  swapPriceRoute: VeloraPriceRoute | null;
  useLoanAssetAsInput: boolean;
  onSuccess?: () => void;
};

const LEVERAGE_SWAP_SLIPPAGE_BPS = Math.round(DEFAULT_SLIPPAGE_PERCENT * 100);

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
  totalAddedCollateral,
  swapPriceRoute,
  useLoanAssetAsInput,
  onSuccess,
}: UseLeverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('leverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const isSwapRoute = route?.kind === 'swap';
  const usePermit2ForRoute = usePermit2Setting;

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
  const isLoanAssetInput = useLoanAssetAsInput;
  const inputTokenAddress = isLoanAssetInput ? (market.loanAsset.address as Address) : (market.collateralAsset.address as Address);
  const inputTokenSymbol = isLoanAssetInput ? market.loanAsset.symbol : market.collateralAsset.symbol;
  const inputTokenDecimals = isLoanAssetInput ? market.loanAsset.decimals : market.collateralAsset.decimals;
  const inputTokenAmountForTransfer = isLoanAssetInput ? collateralAmount : collateralAmountInCollateralToken;
  const approvalSpender = route?.kind === 'swap' ? route.generalAdapterAddress : bundlerAddress;

  const {
    isBundlerAuthorized,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorizationReady,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: authorizationTarget,
  });

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
  const isAuthorizationReadyForRoute = usePermit2ForRoute ? isBundlerAuthorizationReady : isBundlerAuthorizationStatusReady;

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
      if (isSwap && isPermit2) {
        return [
          {
            id: 'approve_permit2',
            title: 'Authorize Permit2',
            description: "One-time approval so future leverage transactions don't need token approvals.",
          },
          {
            id: 'authorize_bundler_sig',
            title: 'Authorize Morpho Adapter',
            description: 'Sign a message authorizing the Morpho general adapter for this leverage flow.',
          },
          {
            id: 'sign_permit',
            title: 'Sign Token Permit',
            description: 'Sign Permit2 transfer authorization for the general adapter.',
          },
          {
            id: 'execute',
            title: 'Confirm Leverage',
            description: 'Confirm the Bundler3 leverage transaction in your wallet.',
          },
        ];
      }

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

    const hasCollateralOutput = route.kind === 'swap' && isLoanAssetInput ? totalAddedCollateral > 0n : flashCollateralAmount > 0n;
    if (collateralAmount <= 0n || flashLoanAmount <= 0n || !hasCollateralOutput) {
      toast.info('Invalid leverage inputs', 'Set collateral and multiplier above 1x before submitting.');
      return;
    }

    try {
      const txs: `0x${string}`[] = [];
      let swapRouteAuthorizationCall: Bundler3Call | null = null;
      let swapRoutePermit2Call: Bundler3Call | null = null;

      if (usePermit2ForRoute) {
        if (!permit2Authorized) {
          tracking.update('approve_permit2');
          await authorizePermit2();
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        if (!isBundlerAuthorized) {
          tracking.update('authorize_bundler_sig');
        }
        const { authorized, authorizationTxData, authorizationSignatureData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via signature.');
        }
        if (isBundlerAuthorized && authorizationTxData) {
          throw new Error('Authorization state changed. Please retry leverage.');
        }
        if (authorizationTxData) {
          if (route.kind === 'swap') {
            if (!authorizationSignatureData) {
              throw new Error('Missing Morpho authorization signature payload for swap-backed leverage.');
            }
            swapRouteAuthorizationCall = {
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
          } else {
            txs.push(authorizationTxData);
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        tracking.update('sign_permit');
        const { sigs, permitSingle } = await signForBundlers();
        if (route.kind === 'swap') {
          swapRoutePermit2Call = {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({
              abi: permit2Abi,
              functionName: 'permit',
              args: [account as Address, permitSingle, sigs],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          };
        } else {
          txs.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'approve2',
              args: [permitSingle, sigs, false],
            }),
          );
        }
      } else {
        if (!isBundlerAuthorized) {
          tracking.update('authorize_bundler_tx');
          const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
          if (!authorized) {
            throw new Error('Failed to authorize Bundler via transaction.');
          }
        }

        if (!isApproved) {
          tracking.update('approve_token');
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
        const swapExecutionAddress = route.paraswapAdapterAddress;
        // WHY: when starting from loan on a swap route, we combine the user's loan input
        // with the flash-loaned loan and sell them together before supplying collateral.
        const totalLoanSellAmount = isLoanAssetInput ? inputTokenAmountForTransfer + flashLoanAmount : flashLoanAmount;
        if (totalLoanSellAmount <= 0n) {
          throw new Error('Invalid total sell amount for swap-backed leverage.');
        }

        const activePriceRoute = swapPriceRoute;
        const swapTxPayload = await (async () => {
          const buildPayload = async (ignoreChecks: boolean) =>
            buildVeloraTransactionPayload({
              srcToken: market.loanAsset.address,
              srcDecimals: market.loanAsset.decimals,
              destToken: market.collateralAsset.address,
              destDecimals: market.collateralAsset.decimals,
              srcAmount: totalLoanSellAmount,
              network: market.morphoBlue.chain.id,
              userAddress: swapExecutionAddress,
              priceRoute: activePriceRoute,
              slippageBps: LEVERAGE_SWAP_SLIPPAGE_BPS,
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
        })();

        const trustedVeloraTargets = [activePriceRoute.contractAddress, activePriceRoute.tokenTransferProxy].filter(
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
        const quotedSellAmount = BigInt(activePriceRoute.srcAmount);
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
          {
            to: route.paraswapAdapterAddress,
            data: encodeFunctionData({
              abi: paraswapAdapterAbi,
              functionName: 'erc20Transfer',
              args: [market.loanAsset.address as Address, account as Address, maxUint256],
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
        if (swapRouteAuthorizationCall) {
          bundleCalls.push(swapRouteAuthorizationCall);
        }
        if (swapRoutePermit2Call) {
          bundleCalls.push(swapRoutePermit2Call);
        }

        if (inputTokenAmountForTransfer > 0n) {
          bundleCalls.push({
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: usePermit2ForRoute ? 'permit2TransferFrom' : 'erc20TransferFrom',
              args: [inputTokenAddress, route.generalAdapterAddress, inputTokenAmountForTransfer],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          });
          if (!isLoanAssetInput) {
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
    totalAddedCollateral,
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
      const initialStep: LeverageStepType = usePermit2ForRoute
        ? permit2Authorized
          ? isBundlerAuthorized
            ? 'sign_permit'
            : 'authorize_bundler_sig'
          : 'approve_permit2'
        : isBundlerAuthorized
          ? isApproved
            ? 'execute'
            : 'approve_token'
          : 'authorize_bundler_tx';
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
  }, [
    account,
    usePermit2ForRoute,
    permit2Authorized,
    isBundlerAuthorized,
    isApproved,
    tracking,
    getStepsForFlow,
    isSwapRoute,
    market,
    inputTokenSymbol,
    collateralAmount,
    executeLeverage,
    toast,
  ]);

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
        getStepsForFlow(true, isSwapRoute),
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

  const isLoading =
    leveragePending || (usePermit2ForRoute && isLoadingPermit2) || !isAuthorizationReadyForRoute || isApproving || isAuthorizingBundler;

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
    isBundlerAuthorizationReady: isAuthorizationReadyForRoute,
    approveAndLeverage,
    signAndLeverage,
  };
}
