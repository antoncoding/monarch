import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Address, Hex } from 'viem';
import { useConnection, usePublicClient } from 'wagmi';
import { buildVeloraTransactionPayload, fetchVeloraPriceRoute, getVeloraApprovalTarget, isVeloraRateChangedError } from '../api/velora';
import type { SwapQuoteDisplay, SwapToken } from '../types';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance } from '@/utils/balance';
import { toUserFacingTransactionErrorMessage } from '@/utils/transaction-errors';

type UseVeloraSwapParams = {
  sourceToken: SwapToken | null;
  targetToken: SwapToken | null;
  amount: bigint;
  slippageBps: number;
  onSwapConfirmed?: () => void;
};

type UseVeloraSwapReturn = {
  quote: SwapQuoteDisplay | null;
  isQuoting: boolean;
  isExecuting: boolean;
  error: string | null;
  chainsMatch: boolean;
  approvalTarget: Address | null;
  executeSwap: () => Promise<void>;
  reset: () => void;
};

const QUOTE_DEBOUNCE_MS = 800;

const parseErrorMessage = (err: unknown): string => {
  return toUserFacingTransactionErrorMessage(err, 'An unknown error occurred');
};

/**
 * Hook for managing same-chain swaps through Velora (ParaSwap).
 * Quote path: `/prices`
 * Execution path: `/transactions/:network` + wallet sendTransaction
 */
export function useVeloraSwap({
  sourceToken,
  targetToken,
  amount,
  slippageBps,
  onSwapConfirmed,
}: UseVeloraSwapParams): UseVeloraSwapReturn {
  const { address: account } = useConnection();
  const publicClient = usePublicClient({
    chainId: sourceToken?.chainId,
  });

  const [quote, setQuote] = useState<SwapQuoteDisplay | null>(null);
  const [priceRoute, setPriceRoute] = useState<Awaited<ReturnType<typeof fetchVeloraPriceRoute>> | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false); // preparing payload + submitting tx
  const [error, setError] = useState<string | null>(null);

  const chainsMatch = sourceToken && targetToken ? sourceToken.chainId === targetToken.chainId : false;

  const approvalTarget = useMemo(() => getVeloraApprovalTarget(priceRoute), [priceRoute]);

  const pendingText = useMemo(() => {
    if (!sourceToken || amount <= 0n) return 'Swapping tokens';
    return `Swapping ${formatBalance(amount, sourceToken.decimals)} ${sourceToken.symbol}`;
  }, [sourceToken, amount]);

  const successText = useMemo(() => {
    if (!targetToken) return 'Swap completed';
    return `${targetToken.symbol} swapped`;
  }, [targetToken]);

  const { sendTransactionAsync, isConfirming: swapPending } = useTransactionWithToast({
    toastId: 'velora-swap',
    pendingText,
    successText,
    errorText: 'Failed to swap',
    chainId: sourceToken?.chainId,
    pendingDescription:
      sourceToken && targetToken ? `${sourceToken.symbol} → ${targetToken.symbol} via Velora` : 'Submitting Velora swap transaction',
    successDescription:
      sourceToken && targetToken ? `${sourceToken.symbol} → ${targetToken.symbol} swap confirmed` : 'Swap transaction confirmed',
    onSuccess: () => {
      if (onSwapConfirmed) onSwapConfirmed();
    },
  });

  const getQuote = useCallback(async () => {
    if (!sourceToken || !targetToken || !account || amount <= 0n || sourceToken.chainId !== targetToken.chainId) {
      setQuote(null);
      setPriceRoute(null);
      return;
    }

    setIsQuoting(true);
    setError(null);

    try {
      const nextPriceRoute = await fetchVeloraPriceRoute({
        srcToken: sourceToken.address,
        srcDecimals: sourceToken.decimals,
        destToken: targetToken.address,
        destDecimals: targetToken.decimals,
        amount,
        network: sourceToken.chainId,
        userAddress: account,
      });

      const buyAmount = BigInt(nextPriceRoute.destAmount);
      const sellAmount = BigInt(nextPriceRoute.srcAmount);

      setPriceRoute(nextPriceRoute);
      setQuote({
        buyAmount,
        sellAmount,
      });
    } catch (err: unknown) {
      console.error('Error fetching Velora quote:', err);
      setError(parseErrorMessage(err));
      setQuote(null);
      setPriceRoute(null);
    } finally {
      setIsQuoting(false);
    }
  }, [sourceToken, targetToken, account, amount]);

  const executeSwap = useCallback(async () => {
    if (!sourceToken || !targetToken || !account || !priceRoute) {
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      let activePriceRoute = priceRoute;

      let txPayload;
      try {
        txPayload = await buildVeloraTransactionPayload({
          srcToken: sourceToken.address,
          srcDecimals: sourceToken.decimals,
          destToken: targetToken.address,
          destDecimals: targetToken.decimals,
          srcAmount: amount,
          network: sourceToken.chainId,
          userAddress: account,
          priceRoute: activePriceRoute,
          slippageBps,
        });
      } catch (buildError: unknown) {
        if (!isVeloraRateChangedError(buildError)) {
          throw buildError;
        }

        const refreshedRoute = await fetchVeloraPriceRoute({
          srcToken: sourceToken.address,
          srcDecimals: sourceToken.decimals,
          destToken: targetToken.address,
          destDecimals: targetToken.decimals,
          amount,
          network: sourceToken.chainId,
          userAddress: account,
        });
        activePriceRoute = refreshedRoute;
        setPriceRoute(refreshedRoute);
        setQuote({
          buyAmount: BigInt(refreshedRoute.destAmount),
          sellAmount: BigInt(refreshedRoute.srcAmount),
        });

        const previousSpender = getVeloraApprovalTarget(priceRoute);
        const refreshedSpender = getVeloraApprovalTarget(refreshedRoute);
        if (previousSpender && refreshedSpender && previousSpender.toLowerCase() !== refreshedSpender.toLowerCase()) {
          throw new Error('Swap route changed and requires approval for a new spender. Please approve and retry.');
        }

        txPayload = await buildVeloraTransactionPayload({
          srcToken: sourceToken.address,
          srcDecimals: sourceToken.decimals,
          destToken: targetToken.address,
          destDecimals: targetToken.decimals,
          srcAmount: amount,
          network: sourceToken.chainId,
          userAddress: account,
          priceRoute: activePriceRoute,
          slippageBps,
        });
      }

      const value = txPayload.value ? BigInt(txPayload.value) : 0n;
      const gas = txPayload.gas
        ? BigInt(txPayload.gas)
        : await publicClient?.estimateGas({
            account,
            to: txPayload.to,
            data: txPayload.data as Hex,
            value,
          });

      const baseTx = {
        account,
        to: txPayload.to,
        data: txPayload.data as Hex,
        value,
        gas,
      };

      if (txPayload.maxFeePerGas || txPayload.maxPriorityFeePerGas) {
        await sendTransactionAsync({
          ...baseTx,
          maxFeePerGas: txPayload.maxFeePerGas ? BigInt(txPayload.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: txPayload.maxPriorityFeePerGas ? BigInt(txPayload.maxPriorityFeePerGas) : undefined,
        });
      } else if (txPayload.gasPrice) {
        await sendTransactionAsync({
          ...baseTx,
          gasPrice: BigInt(txPayload.gasPrice),
        });
      } else {
        await sendTransactionAsync(baseTx);
      }
    } catch (err: unknown) {
      console.error('Error executing Velora swap:', err);
      setError(parseErrorMessage(err));
    } finally {
      setIsExecuting(false);
    }
  }, [sourceToken, targetToken, account, amount, slippageBps, priceRoute, publicClient, sendTransactionAsync]);

  const reset = useCallback(() => {
    setQuote(null);
    setPriceRoute(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!sourceToken || !targetToken || amount <= 0n || sourceToken.chainId !== targetToken.chainId) {
      setQuote(null);
      setPriceRoute(null);
      return;
    }

    setError(null);

    const timeoutId = setTimeout(() => {
      void getQuote();
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [sourceToken, targetToken, amount, slippageBps, getQuote]);

  return {
    quote,
    isQuoting,
    isExecuting: isExecuting || swapPending,
    error,
    chainsMatch,
    approvalTarget,
    executeSwap,
    reset,
  };
}
