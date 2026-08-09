import { useCallback } from 'react';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useWalletModal } from '@/components/providers/WalletModalProvider';

export function useRequirePositionAccount(expectedAccount?: Address) {
  const { address } = useConnection();
  const { openWalletModal } = useWalletModal();
  const isExpectedAccount = !expectedAccount || address?.toLowerCase() === expectedAccount.toLowerCase();

  const requestExpectedAccount = useCallback(() => {
    if (!expectedAccount || address?.toLowerCase() === expectedAccount.toLowerCase()) return;
    openWalletModal();
  }, [address, expectedAccount, openWalletModal]);

  return { isExpectedAccount, requestExpectedAccount };
}
