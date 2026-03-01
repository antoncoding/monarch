import { useCallback, useMemo } from 'react';
import { type Address, encodeAbiParameters, encodeFunctionData, isAddress, isAddressEqual, keccak256, maxUint256, zeroHash } from 'viem';
import { useConnection } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { bundlerV3Abi } from '@/abis/bundlerV3';
import { morphoGeneralAdapterV1Abi } from '@/abis/morphoGeneralAdapterV1';
import { paraswapAdapterAbi } from '@/abis/paraswapAdapter';
import { buildVeloraTransactionPayload, isVeloraRateChangedError, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { DEFAULT_SLIPPAGE_PERCENT } from '@/features/swap/constants';
import { useBundlerAuthorizationStep } from '@/hooks/useBundlerAuthorizationStep';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';
import type { Market } from '@/utils/types';
import { type Bundler3Call, encodeBundler3Calls, getParaswapSellOffsets, readCalldataUint256 } from './leverage/bundler3';
import { withSlippageFloor } from './leverage/math';
import type { LeverageRoute } from './leverage/types';

export type DeleverageStepType = 'authorize_bundler_sig' | 'authorize_bundler_tx' | 'execute';

type UseDeleverageTransactionProps = {
  market: Market;
  route: LeverageRoute | null;
  withdrawCollateralAmount: bigint;
  maxWithdrawCollateralAmount: bigint;
  flashLoanAmount: bigint;
  repayBySharesAmount: bigint;
  useCloseRoute: boolean;
  autoWithdrawCollateralAmount: bigint;
  maxCollateralForDebtRepay: bigint;
  swapSellPriceRoute: VeloraPriceRoute | null;
  onSuccess?: () => void;
};

const DELEVERAGE_SWAP_SLIPPAGE_BPS = Math.round(DEFAULT_SLIPPAGE_PERCENT * 100);
const SHARE_PRICE_SCALE_E27 = 10n ** 27n;
const SOURCE_TOKEN_LABEL_REGEX = /\b(src token|source token)\b/;
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWholeWord = (message: string, value: string): boolean => {
  if (!value) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(value)}\\b`);
  return pattern.test(message);
};
const computeMaxSharePriceE27 = (maxAssets: bigint, shares: bigint): bigint => {
  if (maxAssets <= 0n || shares <= 0n) return 0n;
  return (maxAssets * SHARE_PRICE_SCALE_E27 + shares - 1n) / shares;
};
const isVeloraBypassablePrecheckError = ({
  error,
  sourceTokenAddress,
  sourceTokenSymbol,
}: {
  error: unknown;
  sourceTokenAddress: string;
  sourceTokenSymbol: string;
}): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const isAllowancePrecheckError = message.includes('allowance given to tokentransferproxy');
  if (isAllowancePrecheckError) return true;

  if (!message.includes('not enough')) return false;
  if (!message.includes('balance') && !message.includes('insufficient')) return false;

  const normalizedSourceAddress = sourceTokenAddress.toLowerCase();
  const normalizedSourceSymbol = sourceTokenSymbol.trim().toLowerCase();
  const referencesSourceToken =
    message.includes(normalizedSourceAddress) || SOURCE_TOKEN_LABEL_REGEX.test(message) || hasWholeWord(message, normalizedSourceSymbol);

  return referencesSourceToken;
};

/**
 * Executes deleverage transactions for:
 * - ERC4626 deterministic loops on Bundler V2
 * - generalized swap-backed loops on Bundler3 + adapters
 */
export function useDeleverageTransaction({
  market,
  route,
  withdrawCollateralAmount,
  maxWithdrawCollateralAmount,
  flashLoanAmount,
  repayBySharesAmount,
  useCloseRoute,
  autoWithdrawCollateralAmount,
  maxCollateralForDebtRepay,
  swapSellPriceRoute,
  onSuccess,
}: UseDeleverageTransactionProps) {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const tracking = useTransactionTracking('deleverage');
  const { address: account, chainId } = useConnection();
  const toast = useStyledToast();
  const isSwapRoute = route?.kind === 'swap';
  const useSignatureAuthorization = usePermit2Setting && !isSwapRoute;
  const bundlerAddress = useMemo<Address>(() => {
    if (route?.kind === 'swap') return route.bundler3Address;
    return getBundlerV2(market.morphoBlue.chain.id) as Address;
  }, [route, market.morphoBlue.chain.id]);
  const authorizationTarget = useMemo<Address>(() => {
    if (route?.kind === 'swap') return route.generalAdapterAddress;
    return bundlerAddress;
  }, [route, bundlerAddress]);
  const { batchAddUserMarkets } = useUserMarketsCache(account);

  const {
    isBundlerAuthorized,
    isBundlerAuthorizationReady,
    isBundlerAuthorizationStatusReady,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  } = useBundlerAuthorizationStep({
    chainId: market.morphoBlue.chain.id,
    bundlerAddress: authorizationTarget,
  });

  const { isConfirming: deleveragePending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'deleverage',
    pendingText: `Deleveraging ${formatBalance(withdrawCollateralAmount, market.collateralAsset.decimals)} ${market.collateralAsset.symbol}`,
    successText: 'Deleverage Executed',
    errorText: 'Failed to execute deleverage',
    chainId,
    pendingDescription: `Executing deleverage on market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: 'Position delevered successfully',
    onSuccess: () => {
      void refetchIsBundlerAuthorized();
      if (onSuccess) void onSuccess();
    },
  });

  const getStepsForFlow = useCallback((isPermit2: boolean, isSwap: boolean) => {
    if (isSwap) {
      return [
        {
          id: 'authorize_bundler_tx',
          title: 'Authorize Morpho Adapter',
          description: 'Submit one transaction authorizing adapter actions on your position.',
        },
        {
          id: 'execute',
          title: 'Confirm Deleverage',
          description: 'Confirm the Bundler3 deleverage transaction in your wallet.',
        },
      ];
    }

    if (isPermit2) {
      return [
        {
          id: 'authorize_bundler_sig',
          title: 'Authorize Morpho Bundler',
          description: 'Sign a message to authorize deleverage actions.',
        },
        {
          id: 'execute',
          title: 'Confirm Deleverage',
          description: 'Confirm the deleverage transaction in your wallet.',
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
        id: 'execute',
        title: 'Confirm Deleverage',
        description: 'Confirm the deleverage transaction in your wallet.',
      },
    ];
  }, []);

  const executeDeleverage = useCallback(async () => {
    if (!account) {
      throw new Error('No account connected. Please connect your wallet.');
    }

    if (!route) {
      throw new Error('This market is not supported for deleverage.');
    }

    if (withdrawCollateralAmount <= 0n || flashLoanAmount <= 0n) {
      throw new Error('Invalid deleverage inputs. Set a collateral unwind amount above zero.');
    }
    if (withdrawCollateralAmount > maxWithdrawCollateralAmount) {
      throw new Error('Stale deleverage input. The maximum unwind amount changed. Please review and try again.');
    }

    try {
      const txs: `0x${string}`[] = [];

      if (useSignatureAuthorization) {
        if (!isBundlerAuthorized) {
          tracking.update('authorize_bundler_sig');
        }
        const { authorized, authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via signature.');
        }
        if (isBundlerAuthorized && authorizationTxData) {
          throw new Error('Authorization state changed. Please retry deleverage.');
        }
        if (authorizationTxData) {
          txs.push(authorizationTxData);
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      } else {
        if (!isBundlerAuthorized) {
          tracking.update('authorize_bundler_tx');
        }
        const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
        if (!authorized) {
          throw new Error('Failed to authorize Bundler via transaction.');
        }
      }

      const marketParams = {
        loanToken: market.loanAsset.address as Address,
        collateralToken: market.collateralAsset.address as Address,
        oracle: market.oracleAddress as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
      };

      const isRepayByShares = useCloseRoute;
      if (isRepayByShares && repayBySharesAmount <= 0n) {
        throw new Error('Debt shares are unavailable for a full close. Refresh your position data and try again.');
      }
      // WHY: when repaying by assets, Morpho expects a *minimum* shares bound.
      // Using an upper-bound style estimate causes false "slippage exceeded" reverts.
      const minRepayShares = 1n;
      const bundlerV2RepaySlippageAmount = isRepayByShares ? flashLoanAmount : minRepayShares;
      const generalAdapterMaxSharePriceE27 = isRepayByShares
        ? computeMaxSharePriceE27(flashLoanAmount, repayBySharesAmount)
        : computeMaxSharePriceE27(flashLoanAmount, minRepayShares);
      if (generalAdapterMaxSharePriceE27 <= 0n) {
        throw new Error('Invalid deleverage bounds for repay-by-shares. Refresh the quote and try again.');
      }

      if (route.kind === 'swap') {
        const swapExecutionAddress = route.paraswapAdapterAddress;
        if (useCloseRoute) {
          if (maxCollateralForDebtRepay <= 0n) {
            throw new Error('The exact close bound is unavailable. Refresh the quote and try again.');
          }
          if (withdrawCollateralAmount < maxCollateralForDebtRepay) {
            throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
          }
        }

        const isCloseSwap = isRepayByShares;
        const activePriceRoute = swapSellPriceRoute;
        if (!activePriceRoute) {
          throw new Error('Missing Velora swap quote for deleverage.');
        }

        const swapTxPayload = await (async () => {
          const buildPayload = async (ignoreChecks: boolean) =>
            buildVeloraTransactionPayload({
              srcToken: market.collateralAsset.address,
              srcDecimals: market.collateralAsset.decimals,
              destToken: market.loanAsset.address,
              destDecimals: market.loanAsset.decimals,
              srcAmount: withdrawCollateralAmount,
              network: market.morphoBlue.chain.id,
              userAddress: swapExecutionAddress,
              priceRoute: activePriceRoute,
              slippageBps: DELEVERAGE_SWAP_SLIPPAGE_BPS,
              ignoreChecks,
            });

          try {
            return await buildPayload(false);
          } catch (buildError: unknown) {
            if (isVeloraRateChangedError(buildError)) {
              throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
            }
            if (
              !isVeloraBypassablePrecheckError({
                error: buildError,
                sourceTokenAddress: market.collateralAsset.address,
                sourceTokenSymbol: market.collateralAsset.symbol,
              })
            ) {
              throw buildError;
            }

            try {
              return await buildPayload(true);
            } catch (fallbackBuildError: unknown) {
              if (isVeloraRateChangedError(fallbackBuildError)) {
                throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
              }
              throw fallbackBuildError;
            }
          }
        })();

        const trustedVeloraTargets = [activePriceRoute.contractAddress, activePriceRoute.tokenTransferProxy].filter(
          (candidate): candidate is Address => typeof candidate === 'string' && isAddress(candidate),
        );
        if (trustedVeloraTargets.length === 0 || !trustedVeloraTargets.some((target) => isAddressEqual(swapTxPayload.to, target))) {
          throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
        }

        const sellOffsets = getParaswapSellOffsets(swapTxPayload.data);
        const quotedSellCollateral = BigInt(activePriceRoute.srcAmount);
        const quotedLoanOut = BigInt(activePriceRoute.destAmount);
        const calldataSellAmount = readCalldataUint256(swapTxPayload.data, sellOffsets.exactAmount);
        const calldataQuotedLoanOut = readCalldataUint256(swapTxPayload.data, sellOffsets.quotedAmount);
        if (
          quotedSellCollateral !== withdrawCollateralAmount ||
          calldataSellAmount !== withdrawCollateralAmount ||
          calldataQuotedLoanOut !== quotedLoanOut
        ) {
          throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
        }

        const swapCallData = swapTxPayload.data;
        const minLoanOut = withSlippageFloor(quotedLoanOut);
        if (isCloseSwap) {
          if (minLoanOut < flashLoanAmount) {
            throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
          }
        } else if (minLoanOut <= 0n) {
          throw new Error('Velora returned zero loan output for deleverage swap.');
        }

        const calldataMinLoanOut = readCalldataUint256(swapTxPayload.data, sellOffsets.limitAmount);
        if (calldataMinLoanOut !== minLoanOut) {
          throw new Error('Deleverage quote changed. Please review the updated preview and try again.');
        }

        const callbackBundle: Bundler3Call[] = [
          {
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'morphoRepay',
              args: [
                marketParams,
                isRepayByShares ? 0n : flashLoanAmount,
                isRepayByShares ? repayBySharesAmount : 0n,
                generalAdapterMaxSharePriceE27,
                account as Address,
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
                swapCallData,
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
              args: [marketParams, autoWithdrawCollateralAmount, account as Address],
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
          {
            to: route.generalAdapterAddress,
            data: encodeFunctionData({
              abi: morphoGeneralAdapterV1Abi,
              functionName: 'erc20Transfer',
              args: [market.loanAsset.address as Address, account as Address, maxUint256],
            }),
            value: 0n,
            skipRevert: false,
            callbackHash: zeroHash,
          },
        ];

        tracking.update('execute');
        await new Promise((resolve) => setTimeout(resolve, 700));

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
        const callbackTxs: `0x${string}`[] = [
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoRepay',
            args: [
              marketParams,
              isRepayByShares ? 0n : flashLoanAmount,
              isRepayByShares ? repayBySharesAmount : 0n,
              bundlerV2RepaySlippageAmount,
              account as Address,
              '0x',
            ],
          }),
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoWithdrawCollateral',
            args: [marketParams, withdrawCollateralAmount, bundlerAddress as Address],
          }),
        ];

        const minAssetsOut = withSlippageFloor(flashLoanAmount);
        callbackTxs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc4626Redeem',
            args: [route.collateralVault, withdrawCollateralAmount, minAssetsOut, bundlerAddress as Address, bundlerAddress as Address],
          }),
        );

        if (autoWithdrawCollateralAmount > 0n) {
          // WHY: if deleverage fully clears debt, keeping collateral locked in Morpho adds friction.
          // We withdraw the remaining collateral in the same transaction so the position is closed.
          callbackTxs.push(
            encodeFunctionData({
              abi: morphoBundlerAbi,
              functionName: 'morphoWithdrawCollateral',
              args: [marketParams, autoWithdrawCollateralAmount, account as Address],
            }),
          );
        }

        const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoFlashLoan',
            args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
          }),
        );

        tracking.update('execute');
        await new Promise((resolve) => setTimeout(resolve, 700));

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
      console.error('Error during deleverage execution:', error);
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'An unexpected error occurred during deleverage.');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Deleverage Failed', userFacingMessage);
      }
    }
  }, [
    account,
    market,
    route,
    withdrawCollateralAmount,
    maxWithdrawCollateralAmount,
    flashLoanAmount,
    repayBySharesAmount,
    useCloseRoute,
    autoWithdrawCollateralAmount,
    maxCollateralForDebtRepay,
    swapSellPriceRoute,
    useSignatureAuthorization,
    isBundlerAuthorized,
    ensureBundlerAuthorization,
    bundlerAddress,
    sendTransactionAsync,
    batchAddUserMarkets,
    tracking,
    toast,
  ]);

  const authorizeAndDeleverage = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet.');
      return;
    }
    if ((useSignatureAuthorization && !isBundlerAuthorizationReady) || (!useSignatureAuthorization && !isBundlerAuthorizationStatusReady)) {
      toast.info('Authorization status loading', 'Please wait a moment and try again.');
      return;
    }

    try {
      const initialStep: DeleverageStepType = isBundlerAuthorized
        ? 'execute'
        : useSignatureAuthorization
          ? 'authorize_bundler_sig'
          : 'authorize_bundler_tx';
      tracking.start(
        getStepsForFlow(useSignatureAuthorization, isSwapRoute),
        {
          title: 'Deleverage',
          description: `${market.collateralAsset.symbol} unwound into ${market.loanAsset.symbol}`,
          tokenSymbol: market.collateralAsset.symbol,
          amount: withdrawCollateralAmount,
          marketId: market.uniqueKey,
        },
        initialStep,
      );

      await executeDeleverage();
    } catch (error: unknown) {
      console.error('Error in authorizeAndDeleverage:', error);
      tracking.fail();
      const userFacingMessage = toUserFacingTransactionErrorMessage(error, 'Failed to process deleverage transaction');
      if (userFacingMessage !== 'User rejected transaction.') {
        toast.error('Error', userFacingMessage);
      }
    }
  }, [
    account,
    isBundlerAuthorized,
    isBundlerAuthorizationReady,
    isBundlerAuthorizationStatusReady,
    useSignatureAuthorization,
    tracking,
    getStepsForFlow,
    isSwapRoute,
    market,
    withdrawCollateralAmount,
    executeDeleverage,
    toast,
  ]);

  const isAuthorizationStatusLoading =
    (useSignatureAuthorization && !isBundlerAuthorizationReady) || (!useSignatureAuthorization && !isBundlerAuthorizationStatusReady);
  const isLoading = deleveragePending || isAuthorizingBundler || isAuthorizationStatusLoading;

  return {
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as DeleverageStepType | null,
    deleveragePending,
    isLoading,
    isBundlerAuthorized,
    authorizeAndDeleverage,
  };
}
