import { useCallback } from 'react';
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

const WRAP_STEPS = [
  { id: 'approve', title: 'Approve MORPHO', description: 'Approve legacy MORPHO tokens for wrapping' },
  { id: 'wrap', title: 'Wrap MORPHO', description: 'Confirm transaction to wrap your MORPHO tokens' },
];

export function useWrapLegacyMorpho(amount: bigint, onSuccess?: () => void) {
  const tracking = useTransactionTracking('wrap');

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
      tracking.complete();
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

      tracking.start(
        WRAP_STEPS,
        {
          title: 'Wrap MORPHO',
          description: 'Wrapping legacy MORPHO tokens',
          tokenSymbol: 'MORPHO',
          amount,
        },
        'approve',
      );

      if (!isApproved) {
        await approve();
      }

      tracking.update('wrap');
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
      tracking.fail();
    }
  }, [account, amount, chainId, isApproved, approve, sendTransactionAsync, switchChainAsync, tracking]);

  return {
    wrap,
    // Transaction tracking
    transaction: tracking.transaction,
    dismiss: tracking.dismiss,
    currentStep: tracking.currentStep as WrapStep | null,
    isApproved,
  };
}
