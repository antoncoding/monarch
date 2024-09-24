import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'abitype';
import { maxUint256 } from 'viem';
import { Chain } from 'viem/chains';
import { useReadContract, useSignTypedData } from 'wagmi';
import { useTransactionWithToast } from './useTransactionWithToast';

import permit2Abi from '@/abis/permit2';
import { PERMIT2_ADDRESS } from '@/utils/permit2';
import { useAllowance } from './useAllowance';
import moment from 'moment';

type Props = {
  token: Address;
  chainId?: Chain['id'];
  user: Address | undefined;
  spender: Address | undefined;
  refetchInterval?: number;
  tokenSymbol?: string;
  amount: bigint;
};

/**
 * @param enabled Conditionally run the hook query
 * @param address Address for the contract
 * @param chainId Chain ID for the contract. If not provided, the chain ID from the connected wallet will be used.
 * @param refetchInterval Interval in milliseconds to refetch the contract data
 * @returns JsonMetadata
 */
export function usePermit2({
  user,
  chainId = 1,
  token,
  spender,
  refetchInterval = 10000,
  amount,
}: Props) {
  const {
    allowance: allowanceToPermit2,
    approveInfinite: authorizePermit2,
    isLoadingAllowance,
  } = useAllowance({
    user,
    spender: PERMIT2_ADDRESS,
    token,
    chainId,
    refetchInterval,
  });

  const { data: packedAllowance } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: 'allowance', // read packed allowance
    args: [user, token, spender],
    chainId,
  });

  // const [amount, expiration, nonce] = packedAllowance ? packedAllowance : [0, 0, 0]
  console.log('packedAllowance', packedAllowance);

  const isLoading = useMemo(() => isLoadingAllowance, [isLoadingAllowance]);

  const { data: signature, signTypedDataAsync } = useSignTypedData({});

  const permit2Authorized = useMemo(
    () => allowanceToPermit2 && allowanceToPermit2 > 0,
    [allowanceToPermit2],
  );

  const signForBundlers = useCallback(async () => {
    if (!user || !spender || !token) throw new Error('User, spender, or token not provided');

    const permitSingle = {
      details: {
        token: token,
        amount: amount,
        expiration: moment.now() + 600,
        nonce: packedAllowance ? ((packedAllowance as number[])[2] as number) : 0,
      },
      spender: spender,
      sigDeadline: maxUint256,
    };

    // sign erc712 signature for permit2
    const sigs = await signTypedDataAsync({
      types: {
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
        // (PermitDetails details,address spender,uint256 sigDeadline)
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      primaryType: 'PermitSingle',
      message: permitSingle,
    });

    return { sigs, permitSingle };
  }, [user, spender, token, chainId, packedAllowance]);

  return { permit2Authorized, authorizePermit2, signForBundlers, isLoading, signature };
}
