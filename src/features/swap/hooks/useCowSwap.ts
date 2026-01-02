import { useCallback, useEffect, useState } from 'react';
import { useConnection, usePublicClient, useWalletClient } from 'wagmi';
import { OrderKind, setGlobalAdapter, type QuoteAndPost } from '@cowprotocol/cow-sdk';
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter';
import { tradingSdk } from '../cowSwapSdk';
import type { SwapQuoteDisplay, SwapToken } from '../types';

type UseCowSwapParams = {
  sourceToken: SwapToken | null;
  targetToken: SwapToken | null;
  amount: bigint;
  slippageBps: number;
};

type UseCowSwapReturn = {
  quote: SwapQuoteDisplay | null;
  isQuoting: boolean;
  isExecuting: boolean;
  error: string | null;
  orderUid: string | null;
  chainsMatch: boolean;

  executeSwap: () => Promise<void>;
  reset: () => void;
};

/**
 * Hook for managing CoW Protocol same-chain swaps
 */
export function useCowSwap({ sourceToken, targetToken, amount, slippageBps }: UseCowSwapParams): UseCowSwapReturn {
  const { address: account } = useConnection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [quote, setQuote] = useState<SwapQuoteDisplay | null>(null);
  const [quoteAndPost, setQuoteAndPost] = useState<QuoteAndPost | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderUid, setOrderUid] = useState<string | null>(null);

  // Check if source and target chains match
  const chainsMatch = sourceToken && targetToken ? sourceToken.chainId === targetToken.chainId : false;

  // Bind SDK to wagmi
  useEffect(() => {
    if (!walletClient || !publicClient) return;

    try {
      const adapter = new ViemAdapter({
        provider: publicClient,
        walletClient,
      });

      setGlobalAdapter(adapter);

      if (sourceToken?.chainId) {
        tradingSdk.setTraderParams({ chainId: sourceToken.chainId });
      }
    } catch (err) {
      console.error('Failed to bind SDK to wagmi:', err);
    }
  }, [publicClient, walletClient, sourceToken?.chainId]);

  /**
   * Parse error to extract description from CoW Protocol API errors
   */
  const parseErrorDescription = (err: unknown): string => {
    if (err && typeof err === 'object' && 'description' in err && typeof err.description === 'string') {
      return err.description;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'An unknown error occurred';
  };

  /**
   * Get quote for swap
   */
  const getQuote = useCallback(async () => {
    if (!sourceToken || !targetToken || !account || amount === BigInt(0)) {
      setQuote(null);
      setQuoteAndPost(null);
      return;
    }

    // Only fetch quote if chains match
    if (sourceToken.chainId !== targetToken.chainId) {
      setQuote(null);
      setQuoteAndPost(null);
      return;
    }

    setIsQuoting(true);
    setError(null);

    try {
      // Update SDK chain if needed
      tradingSdk.setTraderParams({ chainId: sourceToken.chainId });

      const result = await tradingSdk.getQuote({
        chainId: sourceToken.chainId,
        kind: OrderKind.SELL,
        owner: account,
        amount: amount.toString(),
        sellToken: sourceToken.address,
        sellTokenDecimals: sourceToken.decimals,
        buyToken: targetToken.address,
        buyTokenDecimals: targetToken.decimals,
        slippageBps,
      });

      // Store the QuoteAndPost for later execution
      setQuoteAndPost(result);

      // Extract display info
      setQuote({
        buyAmount: result.quoteResults.amountsAndCosts.afterNetworkCosts.buyAmount,
        sellAmount: amount,
      });
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError(parseErrorDescription(err));
      setQuote(null);
      setQuoteAndPost(null);
    } finally {
      setIsQuoting(false);
    }
  }, [sourceToken, targetToken, account, amount, slippageBps]);

  /**
   * Execute the swap
   */
  const executeSwap = useCallback(async () => {
    if (!quoteAndPost) return;

    setIsExecuting(true);
    setError(null);

    try {
      const result = await quoteAndPost.postSwapOrderFromQuote({
        appData: {
          metadata: {
            quote: {
              slippageBips: slippageBps,
            },
          },
        },
      });

      if (!result) {
        throw new Error('No response from order posting');
      }

      setOrderUid(result.orderId);
    } catch (err) {
      setError(parseErrorDescription(err));
    } finally {
      setIsExecuting(false);
    }
  }, [quoteAndPost, slippageBps]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setQuote(null);
    setQuoteAndPost(null);
    setError(null);
    setOrderUid(null);
  }, []);

  // Auto-fetch quote when parameters change (only if chains match)
  useEffect(() => {
    if (!sourceToken || !targetToken || amount === BigInt(0)) {
      setQuote(null);
      setQuoteAndPost(null);
      return;
    }

    // Don't fetch if chains don't match
    if (sourceToken.chainId !== targetToken.chainId) {
      setQuote(null);
      setQuoteAndPost(null);
      return;
    }

    // Reset state
    setOrderUid(null);
    setError(null);

    // Debounce quote fetching
    const timeoutId = setTimeout(() => {
      void getQuote();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [sourceToken, targetToken, amount, slippageBps, getQuote]);

  return {
    quote,
    isQuoting,
    isExecuting,
    error,
    orderUid,
    chainsMatch,
    executeSwap,
    reset,
  };
}
