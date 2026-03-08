import { type Address, isAddress, isAddressEqual } from 'viem';
import { buildVeloraTransactionPayload, isVeloraRateChangedError, type VeloraPriceRoute } from '@/features/swap/api/velora';
import { isVeloraBypassablePrecheckError } from './velora-precheck';

type BuildVeloraBundlerTransactionPayloadParams = {
  destinationTokenAddress: string;
  destinationTokenDecimals: number;
  executionAddress: Address;
  network: number;
  priceRoute: VeloraPriceRoute;
  quoteChangedMessage: string;
  slippageBps: number;
  sourceTokenAddress: string;
  sourceTokenAmount: bigint;
  sourceTokenDecimals: number;
  sourceTokenSymbol: string;
};

export const buildVeloraBundlerTransactionPayload = async ({
  destinationTokenAddress,
  destinationTokenDecimals,
  executionAddress,
  network,
  priceRoute,
  quoteChangedMessage,
  slippageBps,
  sourceTokenAddress,
  sourceTokenAmount,
  sourceTokenDecimals,
  sourceTokenSymbol,
}: BuildVeloraBundlerTransactionPayloadParams) => {
  const buildPayload = async (ignoreChecks: boolean) =>
    buildVeloraTransactionPayload({
      srcToken: sourceTokenAddress,
      srcDecimals: sourceTokenDecimals,
      destToken: destinationTokenAddress,
      destDecimals: destinationTokenDecimals,
      srcAmount: sourceTokenAmount,
      network,
      userAddress: executionAddress,
      priceRoute,
      slippageBps,
      ignoreChecks,
    });

  try {
    return await buildPayload(false);
  } catch (buildError: unknown) {
    if (isVeloraRateChangedError(buildError)) {
      throw new Error(quoteChangedMessage);
    }

    if (
      !isVeloraBypassablePrecheckError({
        error: buildError,
        sourceTokenAddress,
        sourceTokenSymbol,
      })
    ) {
      throw buildError;
    }

    try {
      return await buildPayload(true);
    } catch (fallbackBuildError: unknown) {
      if (isVeloraRateChangedError(fallbackBuildError)) {
        throw new Error(quoteChangedMessage);
      }

      throw fallbackBuildError;
    }
  }
};

export const assertTrustedVeloraExecutionTarget = ({
  priceRoute,
  quoteChangedMessage,
  transactionTarget,
}: {
  priceRoute: VeloraPriceRoute;
  quoteChangedMessage: string;
  transactionTarget: Address;
}) => {
  const trustedTargets = [priceRoute.contractAddress, priceRoute.tokenTransferProxy].filter(
    (candidate): candidate is Address => typeof candidate === 'string' && isAddress(candidate),
  );

  if (trustedTargets.length === 0 || !trustedTargets.some((target) => isAddressEqual(transactionTarget, target))) {
    throw new Error(quoteChangedMessage);
  }
};
