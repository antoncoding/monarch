import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';

import wrapperABI from '@/abis/morpho-wrapper';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHO_LEGACY, MORPHO_TOKEN_WRAPPER } from '@/utils/tokens';
import { useERC20Approval } from './useERC20Approval';

export type WrapStep = 'approve' | 'wrap';

export function useWrapLegacyMorpho(amount: bigint, onSuccess?: () => void) {
  const [currentStep, setCurrentStep] = useState<WrapStep>('approve');
  const [showProcessModal, setShowProcessModal] = useState(false);

  const { address: account, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const { isApproved, approve } = useERC20Approval({
    token: MORPHO_LEGACY as Address,
    spender: MORPHO_TOKEN_WRAPPER as Address,
    amount,
    tokenSymbol: 'MORPHO',
    chainId: SupportedNetworks.Mainnet,
  });

  const { sendTransactionAsync } = useTransactionWithToast({
    toastId: 'wrap-morpho',
    pendingText: 'Wrapping MORPHO...',
    successText: 'Successfully wrapped MORPHO tokens!',
    errorText: 'Failed to wrap MORPHO tokens',
    onSuccess: () => {
      setShowProcessModal(false);
      onSuccess?.();
    },
  });

  const wrap = useCallback(async () => {
    try {
      if (!account) {
        toast.error('Wallet not connected');
        return;
      }

      if (chainId !== SupportedNetworks.Mainnet) {
        await switchChainAsync({ chainId: SupportedNetworks.Mainnet });
        toast.info('Network changed');
      }

      setShowProcessModal(true);
      if (!isApproved) {
        setCurrentStep('approve');
        await approve();
      }

      setCurrentStep('wrap');
      await sendTransactionAsync({
        account: account,
        to: MORPHO_TOKEN_WRAPPER,
        data: encodeFunctionData({
          abi: wrapperABI,
          functionName: 'depositFor',
          args: [account, amount],
        }),
      });
    } catch (err) {
      toast.error('Failed to wrap MORPHO.');
      setShowProcessModal(false);
    }
  }, [account, amount, chainId, isApproved, approve, sendTransactionAsync, switchChainAsync]);

  return {
    wrap,
    currentStep,
    showProcessModal,
    setShowProcessModal,
    isApproved,
  };
}
