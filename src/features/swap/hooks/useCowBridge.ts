import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { OrderKind } from '@cowprotocol/contracts';
import {
  isBridgeQuoteAndPost,
  NATIVE_CURRENCY_ADDRESS,
  setGlobalAdapter,
  type BridgeQuoteAndPost,
  type CrossChainQuoteAndPost,
  type QuoteBridgeRequest,
} from '@cowprotocol/cow-sdk';
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter';
import { bridgingSdk } from '../cowBridgingSdk';
import type { SwapQuoteDisplay, SwapToken } from '../types';

type UseCowBridgeParams = {
  sourceToken: SwapToken | null;
  targetToken: SwapToken;
  amount: bigint;
  slippageBps: number;
};

type UseCowBridgeReturn = {
  quote: SwapQuoteDisplay | null;
  rawQuote: CrossChainQuoteAndPost | null;
  isQuoting: boolean;
  isApproving: boolean;
  isExecuting: boolean;
  needsApproval: boolean;
  currentAllowance: bigint | null;
  error: Error | null;
  orderUid: string | null;

  getQuote: () => Promise<void>;
  approveToken: () => Promise<void>;
  executeSwap: () => Promise<void>;
  reset: () => void;
};

/**
 * Hook for managing CoW Protocol swaps and cross-chain bridges
 */
export function useCowBridge({
  sourceToken,
  targetToken,
  amount,
  slippageBps,
}: UseCowBridgeParams): UseCowBridgeReturn {
  const { address: account, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [quote, setQuote] = useState<SwapQuoteDisplay | null>(null);
  const [rawQuote, setRawQuote] = useState<CrossChainQuoteAndPost | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null);
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

      bridgingSdk.setTraderParams({ chainId });
    } catch (err) {
      console.error('Failed to bind SDK to wagmi:', err);
    }
  }, [publicClient, walletClient, chainId]);

  // Check if token is native (ETH, MATIC, etc.)
  const isNativeToken = sourceToken?.address.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase();

  // Determine if approval is needed
  const needsApproval = !isNativeToken && currentAllowance !== null && currentAllowance < amount;

  /**
   * Check current allowance for ERC-20 token
   */
  const checkAllowance = useCallback(async () => {
    if (!sourceToken || !account || isNativeToken) {
      setCurrentAllowance(null);
      return;
    }

    try {
      const allowance = await bridgingSdk.getCowProtocolAllowance({
        tokenAddress: sourceToken.address,
        owner: account,
        chainId: sourceToken.chainId,
      });

      setCurrentAllowance(allowance);
    } catch (err) {
      console.error('Error checking allowance:', err);
      setCurrentAllowance(null);
    }
  }, [sourceToken, account, isNativeToken]);

  /**
   * Approve CoW Protocol to spend source token
   */
  const approveToken = useCallback(async () => {
    if (!sourceToken || !account) return;

    setIsApproving(true);
    setError(null);

    try {
      await bridgingSdk.approveCowProtocol({
        tokenAddress: sourceToken.address,
        amount,
        chainId: sourceToken.chainId,
      });

      // Refresh allowance after approval
      await checkAllowance();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Approval failed'));
    } finally {
      setIsApproving(false);
    }
  }, [sourceToken, account, amount, checkAllowance]);

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
        amount: amount.toString(),
        account,
        receiver: account,
      };

      const quoteResult = await bridgingSdk.getQuote(quoteBridgeRequest, {
        slippageBps,
      });

      setRawQuote(quoteResult);

      // Parse quote result
      if (isBridgeQuoteAndPost(quoteResult)) {
        // Cross-chain quote
        const bridgeQuote = quoteResult as BridgeQuoteAndPost;
        setQuote({
          type: 'cross-chain',
          buyAmount: bridgeQuote.quoteResults.amountsAndCosts.afterNetworkCosts.buyAmount,
          bridgeProvider: bridgeQuote.bridge.providerInfo.name,
          bridgeFee: bridgeQuote.bridge.fees.bridgeFee,
          estimatedTimeSeconds: bridgeQuote.bridge.expectedFillTimeSeconds,
          destinationGasFee: bridgeQuote.bridge.fees.destinationGasFee,
        });
      } else {
        // Same-chain quote
        setQuote({
          type: 'same-chain',
          buyAmount: quoteResult.quoteResults.amountsAndCosts.afterNetworkCosts.buyAmount,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get quote'));
      setQuote(null);
      setRawQuote(null);
    } finally {
      setIsQuoting(false);
    }
  }, [sourceToken, targetToken, account, amount, slippageBps]);

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
      setError(err instanceof Error ? err : new Error('Failed to execute swap'));
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
    setCurrentAllowance(null);
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

    // Check allowance for ERC-20 tokens
    if (!isNativeToken) {
      void checkAllowance();
    }

    // Debounce quote fetching
    const timeoutId = setTimeout(() => {
      void getQuote();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [sourceToken, amount, slippageBps, getQuote, checkAllowance, isNativeToken]);

  return {
    quote,
    rawQuote,
    isQuoting,
    isApproving,
    isExecuting,
    needsApproval,
    currentAllowance,
    error,
    orderUid,
    getQuote,
    approveToken,
    executeSwap,
    reset,
  };
}
