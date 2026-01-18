import { useCallback, useState } from 'react';
import { type Address, encodeFunctionData } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import type { Market } from '@/utils/types';
import { useTransactionWithToast } from './useTransactionWithToast';
import { useStyledToast } from './useStyledToast';

type UseAccrueInterestProps = {
  market: Market | undefined;
  onSuccess?: () => void;
};

export function useAccrueInterest({ market, onSuccess }: UseAccrueInterestProps) {
  const { address: account } = useConnection();
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  const { sendTransaction, isConfirming } = useTransactionWithToast({
    toastId: 'accrue-interest',
    pendingText: 'Accruing Interest',
    successText: 'Interest Accrued',
    errorText: 'Failed to accrue interest',
    chainId: market?.morphoBlue.chain.id,
    pendingDescription: 'Accruing interest...',
    successDescription: 'Interest has been accrued',
    onSuccess,
  });

  const accrueInterest = useCallback(async () => {
    if (!market) return;

    await switchChainAsync({ chainId: market.morphoBlue.chain.id });

    const morphoAddress = market.morphoBlue.address as Address;

    sendTransaction({
      to: morphoAddress,
      account,
      data: encodeFunctionData({
        abi: morphoAbi,
        functionName: 'accrueInterest',
        args: [
          {
            loanToken: market.loanAsset.address as Address,
            collateralToken: market.collateralAsset.address as Address,
            oracle: market.oracleAddress as Address,
            irm: market.irmAddress as Address,
            lltv: BigInt(market.lltv),
          },
        ],
      }),
      chainId: market.morphoBlue.chain.id,
    });
  }, [market, account, switchChainAsync, sendTransaction]);

  return {
    accrueInterest,
    isLoading: isConfirming,
  };
}
