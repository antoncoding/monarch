import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';

import wrapperABI from '@/abis/morpho-wrapper';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHO_LEGACY, MORPHO_TOKEN_WRAPPER } from '@/utils/tokens';
import { useERC20Approval } from './useERC20Approval';

export type WrapStep = 'approve' | 'wrap';

export function useWrapLegacyMorpho(amount: bigint, onSuccess?: () => void) {
  const [currentStep, setCurrentStep] = useState<WrapStep>('approve');

  const { start, complete, fail, showModal, setModalOpen } = useTransactionTracking('wrap');

  const { address: account, chainId } = useConnection();
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
      complete();
      onSuccess?.();
    },
  });

  const getStepsForFlow = useCallback(() => {
    return [
      { key: 'approve', label: 'Approve MORPHO', detail: 'Approve legacy MORPHO tokens for wrapping' },
      { key: 'wrap', label: 'Wrap MORPHO', detail: 'Confirm transaction to wrap your MORPHO tokens' },
    ];
  }, []);

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

      start(getStepsForFlow(), { tokenSymbol: 'MORPHO', amount }, 'approve');

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
    } catch (_err) {
      toast.error('Failed to wrap MORPHO.');
      fail();
    }
  }, [account, amount, chainId, isApproved, approve, sendTransactionAsync, switchChainAsync, start, fail, getStepsForFlow]);

  return {
    wrap,
    currentStep,
    showProcessModal: showModal,
    setShowProcessModal: setModalOpen,
    isApproved,
  };
}
