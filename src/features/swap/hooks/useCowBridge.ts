import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { OrderKind, setGlobalAdapter } from '@cowprotocol/cow-sdk';
import {
  isBridgeQuoteAndPost,
  type BridgeQuoteAndPost,
  type CrossChainQuoteAndPost,
  type QuoteBridgeRequest,
} from '@cowprotocol/sdk-bridging';
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter';
import { bridgingSdk, tradingSdk } from '../cowBridgingSdk';
import type { SwapQuoteDisplay, SwapToken } from '../types';
import { SWAP_APP_CODE } from '../constants';

type UseCowBridgeParams = {
  sourceToken: SwapToken | null;
  targetToken: SwapToken;
  amount: bigint;
  slippageBps: number;
};

type UseCowBridgeReturn = {
  quote: SwapQuoteDisplay | null;
  isQuoting: boolean;
  isExecuting: boolean;
  error: string | null;
  orderUid: string | null;

  executeSwap: () => Promise<void>;
  reset: () => void;
};

/**
 * Hook for managing CoW Protocol swaps and cross-chain bridges
 */
export function useCowBridge({ sourceToken, targetToken, amount, slippageBps }: UseCowBridgeParams): UseCowBridgeReturn {
  const { address: account, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [quote, setQuote] = useState<SwapQuoteDisplay | null>(null);
  const [rawQuote, setRawQuote] = useState<CrossChainQuoteAndPost | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderUid, setOrderUid] = useState<string | null>(null);

  // Bind SDK to wagmi
  useEffect(() => {
    if (!walletClient || !chainId || !publicClient) return;

    try {
      setGlobalAdapter(
        new ViemAdapter({
          provider: publicClient,
          walletClient,
        }),
      );

      tradingSdk.setTraderParams({ chainId });
    } catch (err) {
      console.error('Failed to bind SDK to wagmi:', err);
    }
  }, [publicClient, walletClient, chainId]);

  /**
   * Parse error to extract description from CoW Protocol API errors
   * Format: { errorType: string, description: string }
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
   * Get quote for swap/bridge
   */
  const getQuote = useCallback(async () => {
    if (!sourceToken || !account || amount === BigInt(0)) {
      setQuote(null);
      setRawQuote(null);
      return;
    }

    setIsQuoting(true);
    setError(null);

    try {
      const quoteBridgeRequest: QuoteBridgeRequest = {
        sellTokenChainId: sourceToken.chainId,
        sellTokenAddress: sourceToken.address,
        sellTokenDecimals: sourceToken.decimals,
        buyTokenChainId: targetToken.chainId,
        buyTokenAddress: targetToken.address,
        buyTokenDecimals: targetToken.decimals,
        kind: OrderKind.SELL,
        amount,
        account,
        receiver: account,
        signer: walletClient as any, // Viem WalletClient as signer
        appCode: SWAP_APP_CODE,
      };

      const quoteResult = await bridgingSdk.getQuote(quoteBridgeRequest);

      setRawQuote(quoteResult);

      // Parse quote result
      if (isBridgeQuoteAndPost(quoteResult)) {
        // Cross-chain quote
        const bridgeQuote = quoteResult as BridgeQuoteAndPost;
        setQuote({
          type: 'cross-chain',
          buyAmount: bridgeQuote.swap.amountsAndCosts.afterNetworkCosts.buyAmount,
          sellAmount: amount,
          bridgeProvider: bridgeQuote.bridge.providerInfo.name,
          bridgeFee: bridgeQuote.bridge.fees.bridgeFee,
          estimatedTimeSeconds: bridgeQuote.bridge.expectedFillTimeSeconds,
          destinationGasFee: bridgeQuote.bridge.fees.destinationGasFee,
        });
      } else {
        // Same-chain quote (QuoteAndPost)
        setQuote({
          type: 'same-chain',
          buyAmount: quoteResult.quoteResults.amountsAndCosts.afterNetworkCosts.buyAmount,
          sellAmount: amount,
        });
      }
    } catch (err) {
      setError(parseErrorDescription(err));
      setQuote(null);
      setRawQuote(null);
    } finally {
      setIsQuoting(false);
    }
  }, [sourceToken, targetToken, account, amount, slippageBps, walletClient]);

  /**
   * Execute the swap/bridge
   */
  const executeSwap = useCallback(async () => {
    if (!rawQuote) return;

    setIsExecuting(true);
    setError(null);

    try {
      const result = await rawQuote.postSwapOrderFromQuote({
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
  }, [rawQuote, slippageBps]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setQuote(null);
    setRawQuote(null);
    setError(null);
    setOrderUid(null);
  }, []);

  // Auto-fetch quote when parameters change
  useEffect(() => {
    if (!sourceToken || amount === BigInt(0)) {
      setQuote(null);
      setRawQuote(null);
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
  }, [sourceToken, amount, slippageBps, getQuote]);

  return {
    quote,
    isQuoting,
    isExecuting,
    error,
    orderUid,
    executeSwap,
    reset,
  };
}
