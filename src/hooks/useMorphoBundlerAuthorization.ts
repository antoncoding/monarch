import { useCallback, useState } from 'react';
import { Address, encodeFunctionData, parseSignature } from 'viem';
import { useAccount, useReadContract, useSignTypedData } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { MORPHO } from '@/utils/morpho';
import { useStyledToast } from './useStyledToast';

type UseMorphoBundlerAuthorizationProps = {
  chainId: number;
  bundlerAddress: Address;
};

export const useMorphoBundlerAuthorization = ({
  chainId,
  bundlerAddress,
}: UseMorphoBundlerAuthorizationProps) => {
  const { address: account } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const toast = useStyledToast();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const { data: isBundlerAuthorized, refetch: refetchIsBundlerAuthorized } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'isAuthorized',
    args: [account as Address, bundlerAddress],
    chainId: chainId,
    query: {
      enabled: !!account && !!bundlerAddress,
    },
  });

  const { data: nonce, refetch: refetchNonce } = useReadContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: 'nonce',
    args: [account as Address],
    chainId: chainId,
    query: {
      enabled: !!account,
    },
  });

  const { sendTransactionAsync: sendBundlerAuthorizationTx, isConfirming: isConfirmingBundlerTx } =
    useTransactionWithToast({
      toastId: 'morpho-authorize',
      pendingText: 'Authorizing Bundler on Morpho',
      successText: 'Bundler Authorized',
      errorText: 'Failed to authorize Bundler',
      chainId,
      onSuccess: () => {
        void refetchIsBundlerAuthorized();
        void refetchNonce();
      },
    });

  const authorizeBundlerWithSignature = useCallback(async () => {
    if (!account || isBundlerAuthorized === true || nonce === undefined) {
      console.log('Skipping authorizeBundlerWithSignature:', {
        account,
        isBundlerAuthorized,
        nonce,
      });
      return null; // Already authorized or missing data
    }

    setIsAuthorizing(true);
    try {
      const domain = {
        chainId: chainId,
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

      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const message = {
        authorizer: account,
        authorized: bundlerAddress,
        isAuthorized: true,
        nonce: nonce,
        deadline: BigInt(deadline),
      };

      const signatureRaw = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Authorization',
        message,
      });

      const signature = parseSignature(signatureRaw);

      const authorizationTxData = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSetAuthorizationWithSig',
        args: [
          {
            authorizer: account as Address,
            authorized: bundlerAddress,
            isAuthorized: true,
            nonce: BigInt(nonce),
            deadline: BigInt(deadline),
          },
          {
            v: Number(signature.v),
            r: signature.r,
            s: signature.s,
          },
          false, // useEOA = false, since we want the bundler to submit
        ],
      });
      await refetchIsBundlerAuthorized();
      await refetchNonce();
      return authorizationTxData;
    } catch (error) {
      console.error('Error during signature authorization:', error);
      if (error instanceof Error && error.message.includes('User rejected')) {
        toast.error('Signature Rejected', 'Authorization signature rejected by user');
      } else {
        toast.error('Authorization Failed', 'Could not authorize bundler via signature');
      }
      throw error; // Re-throw to be caught by the calling function
    } finally {
      setIsAuthorizing(false);
    }
  }, [
    account,
    isBundlerAuthorized,
    nonce,
    chainId,
    bundlerAddress,
    signTypedDataAsync,
    refetchIsBundlerAuthorized,
    refetchNonce,
    toast,
  ]);

  const authorizeBundlerWithTransaction = useCallback(async () => {
    if (!account || isBundlerAuthorized === true) {
      console.log('Skipping authorizeBundlerWithTransaction:', { account, isBundlerAuthorized });
      return true; // Already authorized or no account
    }

    setIsAuthorizing(true);
    try {
      // Simple Morpho setAuthorization transaction
      await sendBundlerAuthorizationTx({
        account: account,
        to: MORPHO,
        data: encodeFunctionData({
          abi: morphoAbi,
          functionName: 'setAuthorization',
          args: [bundlerAddress, true],
        }),
        chainId: chainId,
      });
      return true;
    } catch (error) {
      console.error('Error during transaction authorization:', error);
      // Toast is handled by useTransactionWithToast
      if (error instanceof Error && error.message.includes('User rejected')) {
        // Handle specific user rejection if not caught by useTransactionWithToast
        toast.error('Transaction Rejected', 'Authorization transaction rejected by user');
      }
      return false; // Indicate failure
    } finally {
      setIsAuthorizing(false);
    }
  }, [account, isBundlerAuthorized, bundlerAddress, sendBundlerAuthorizationTx, chainId, toast]);

  return {
    isBundlerAuthorized,
    isAuthorizingBundler: isAuthorizing || isConfirmingBundlerTx,
    authorizeBundlerWithSignature,
    authorizeBundlerWithTransaction,
    refetchIsBundlerAuthorized,
  };
};
