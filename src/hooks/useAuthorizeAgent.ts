import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData, parseSignature } from 'viem';
import { useAccount, useReadContract, useSignTypedData, useSwitchChain } from 'wagmi';
import monarchAgentAbi from '@/abis/monarch-agent-v1';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { AGENT_CONTRACT } from '@/utils/monarch-agent';
import { MONARCH_TX_IDENTIFIER, MORPHO } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { Market } from '@/utils/types';

export enum AuthorizeAgentStep {
  Idle = 'idle',
  Authorize = 'authorize',
  Execute = 'execute',
}

export type MarketCap = {
  market: Market;
  amount: bigint;
};

/**
 * This hook should only be used on Base
 * @param markets
 * @param caps
 * @param onSuccess
 * @returns
 */
export const useAuthorizeAgent = (
  agent: Address,
  marketCaps: MarketCap[],
  onSuccess?: () => void,
) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<AuthorizeAgentStep>(AuthorizeAgentStep.Idle);

  const { switchChainAsync } = useSwitchChain();

  const { address: account, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const { data: isAuthorized } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'isAuthorized',
    args: [account as Address, AGENT_CONTRACT],
  });

  const { data: nonce } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'nonce',
    args: [account as Address],
    chainId: SupportedNetworks.Base,
  });

  const { data: rebalancerAddress } = useReadContract({
    address: AGENT_CONTRACT,
    abi: monarchAgentAbi,
    functionName: 'rebalancers',
    args: [account as Address],
    chainId: SupportedNetworks.Base,
    query: { enabled: !!account },
  });

  const { sendTransactionAsync } = useTransactionWithToast({
    toastId: 'set-agent',
    pendingText: 'Auhorizing Monarch Agent',
    successText: 'Monarch Agent authorized successfully',
    errorText: 'Failed to authorize Monarch Agent',
    chainId: SupportedNetworks.Base,
    onSuccess,
  });

  const executeBatchSetupAgent = useCallback(
    async (onError?: () => void) => {
      if (!account) {
        return;
      }

      if (chainId !== SupportedNetworks.Base) {
        await switchChainAsync({ chainId: SupportedNetworks.Base });
      }

      setIsConfirming(true);

      // multicall transactions
      const transactions: `0x${string}`[] = [];

      try {
        // Step 2: Sign and authorize bundler if needed
        setCurrentStep(AuthorizeAgentStep.Authorize);
        if (isAuthorized === false) {
          const domain = {
            chainId: SupportedNetworks.Base,
            verifyingContract: MORPHO as Address,
          };

          const types = {
            Authorization: [
              { name: 'authorizer', type: 'address' },
              { name: 'authorized', type: 'address' },
              { name: 'isAuthorized', type: 'bool' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          };

          const deadline = Math.floor(Date.now() / 1000) + 3600;

          const value = {
            authorizer: account,
            authorized: AGENT_CONTRACT,
            isAuthorized: true,
            nonce: nonce,
            deadline: BigInt(deadline),
          };

          let signatureRaw;
          try {
            signatureRaw = await signTypedDataAsync({
              domain,
              types,
              primaryType: 'Authorization',
              message: value,
            });
          } catch (error) {
            console.log('Failed to sign authorization:', error);
            toast.error('Signature request was rejected or failed. Please try again.');
            return;
          }
          const signature = parseSignature(signatureRaw);

          const authorizationTx = encodeFunctionData({
            abi: monarchAgentAbi,
            functionName: 'setMorphoAuthorization',
            args: [
              {
                authorizer: account as Address,
                authorized: AGENT_CONTRACT,
                isAuthorized: true,
                nonce: BigInt(nonce ?? 0),
                deadline: BigInt(deadline),
              },
              {
                v: Number(signature.v),
                r: signature.r,
                s: signature.s,
              },
            ],
          });

          transactions.push(authorizationTx);

          // wait 800ms to avoid rabby wallet issue
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        // Step 3: Execute multicall on MonarchAgentV1
        setCurrentStep(AuthorizeAgentStep.Execute);

        // add rebalancer if not set yet
        if (rebalancerAddress !== agent) {
          const rebalancerTx = encodeFunctionData({
            abi: monarchAgentAbi,
            functionName: 'authorize',
            args: [agent],
          });
          transactions.push(rebalancerTx);
        }

        // batch config markets
        const marketIds = marketCaps.map((market) => market.market.uniqueKey as `0x${string}`);
        const caps = marketCaps.map((market) => market.amount);
        const batchConfigData = encodeFunctionData({
          abi: monarchAgentAbi,
          functionName: 'batchConfigMarkets',
          args: [marketIds, caps],
        });
        transactions.push(batchConfigData);

        // Execute all transactions
        const multicallTx = (encodeFunctionData({
          abi: monarchAgentAbi,
          functionName: 'multicall',
          args: [transactions],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`;

        await sendTransactionAsync({
          account,
          to: AGENT_CONTRACT,
          data: multicallTx,
          chainId: SupportedNetworks.Base,
        });
      } catch (error) {
        console.error('Error during agent setup:', error);
        onError?.();
        toast.error('An error occurred during agent setup. Please try again.');
        throw error;
      } finally {
        setIsConfirming(false);
        setCurrentStep(AuthorizeAgentStep.Idle);
      }
    },
    [
      account,
      isAuthorized,
      nonce,
      signTypedDataAsync,
      sendTransactionAsync,
      marketCaps,
      rebalancerAddress,
      chainId,
      switchChainAsync,
    ],
  );

  return {
    executeBatchSetupAgent,
    isConfirming,
    currentStep,
  };
};
