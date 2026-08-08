import { useCallback } from 'react';
import type { Address } from 'viem';
import { useConnection, useConnections, useSwitchConnection } from 'wagmi';
import { useWalletModal } from '@/components/providers/WalletModalProvider';
import { useStyledToast } from '@/hooks/useStyledToast';

export function useRequirePositionAccount(expectedAccount?: Address) {
  const { address } = useConnection();
  const connections = useConnections();
  const { mutateAsync: switchConnection } = useSwitchConnection();
  const { openWalletModal } = useWalletModal();
  const toast = useStyledToast();
  const isExpectedAccount = !expectedAccount || address?.toLowerCase() === expectedAccount.toLowerCase();

  const requestExpectedAccount = useCallback(async () => {
    if (!expectedAccount || address?.toLowerCase() === expectedAccount.toLowerCase()) return;
    const targetConnection = connections.find((connection) =>
      connection.accounts.some((account) => account.toLowerCase() === expectedAccount.toLowerCase()),
    );

    if (targetConnection) {
      try {
        await switchConnection({ connector: targetConnection.connector });
        toast.success('Account switched', 'You can now continue with this position.');
      } catch {
        toast.error('Could not switch account', 'Open your wallet and select the position owner before continuing.');
        openWalletModal();
      }
      return;
    }

    toast.info('Switch account', `Connect the position owner ${expectedAccount.slice(0, 6)}…${expectedAccount.slice(-4)} to continue.`);
    openWalletModal();
  }, [address, connections, expectedAccount, openWalletModal, switchConnection, toast]);

  return { isExpectedAccount, requestExpectedAccount };
}
