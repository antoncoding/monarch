import { useCallback, useState } from 'react';
import { type Address, encodeFunctionData, parseSignature } from 'viem';
import { useConnection, usePublicClient, useReadContract, useSignTypedData } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import morphoAbi from '@/abis/morpho';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { getMorphoAddress } from '@/utils/morpho';

type UseMorphoAuthorizationProps = {
  chainId: number;
  authorized: Address;
};

export const useMorphoAuthorization = ({ chainId, authorized }: UseMorphoAuthorizationProps) => {
  const { address: account } = useConnection();
  const publicClient = usePublicClient({ chainId });
  const { signTypedDataAsync } = useSignTypedData();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const {
    data: isBundlerAuthorized,
    refetch: refetchIsBundlerAuthorized,
    isLoading: isLoadingBundlerAuthorization,
  } = useReadContract({
    address: getMorphoAddress(chainId),
    abi: morphoAbi,
    functionName: 'isAuthorized',
    args: [account as Address, authorized],
    chainId: chainId,
    query: {
      enabled: !!account && !!authorized,
    },
  });

  const { data: nonce, refetch: refetchNonce } = useReadContract({
    address: getMorphoAddress(chainId),
    abi: morphoAbi,
    functionName: 'nonce',
    args: [account as Address],
    chainId: chainId,
    query: {
      enabled: !!account,
    },
  });

  const isBundlerAuthorizationStatusReady = !!account && !isLoadingBundlerAuthorization && isBundlerAuthorized !== undefined;
  const isBundlerAuthorizationReady =
    !!account && isBundlerAuthorizationStatusReady && (isBundlerAuthorized === true || nonce !== undefined);

  const { sendTransactionAsync: sendBundlerAuthorizationTx, isConfirming: isConfirmingBundlerTx } = useTransactionWithToast({
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
    if (!account) {
      throw new Error('No account connected.');
    }

    if (!isBundlerAuthorizationReady) {
      throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
    }

    if (isBundlerAuthorized === true) {
      return null; // Already authorized
    }

    const authorizationNonce = nonce;
    if (authorizationNonce === undefined) {
      throw new Error('Morpho authorization nonce is unavailable. Please wait a moment and try again.');
    }

    setIsAuthorizing(true);
    try {
      const domain = {
        chainId: chainId,
        verifyingContract: getMorphoAddress(chainId) as Address,
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
        authorized: authorized,
        isAuthorized: true,
        nonce: authorizationNonce,
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
            authorized: authorized,
            isAuthorized: true,
            nonce: BigInt(authorizationNonce),
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
    } finally {
      setIsAuthorizing(false);
    }
  }, [
    account,
    isBundlerAuthorized,
    isBundlerAuthorizationReady,
    nonce,
    chainId,
    authorized,
    signTypedDataAsync,
    refetchIsBundlerAuthorized,
    refetchNonce,
  ]);

  const authorizeWithTransaction = useCallback(
    async (shouldAuthorize?: boolean) => {
      const authorize = shouldAuthorize ?? true;
      if (!account) {
        throw new Error('No account connected.');
      }

      if (!isBundlerAuthorizationStatusReady) {
        throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
      }

      // Skip if trying to authorize when already authorized, or revoke when not authorized
      if (authorize && isBundlerAuthorized === true) {
        return true;
      }
      if (!authorize && isBundlerAuthorized === false) {
        return true;
      }

      setIsAuthorizing(true);
      try {
        // Simple Morpho setAuthorization transaction
        const authorizationTxHash = await sendBundlerAuthorizationTx({
          account: account,
          to: getMorphoAddress(chainId),
          data: encodeFunctionData({
            abi: morphoAbi,
            functionName: 'setAuthorization',
            args: [authorized, authorize],
          }),
          chainId: chainId,
        });

        if (!publicClient) {
          throw new Error('Missing public client for authorization confirmation.');
        }

        await publicClient.waitForTransactionReceipt({
          hash: authorizationTxHash,
          confirmations: 1,
        });

        const refreshedAuthorization = await refetchIsBundlerAuthorized();
        const isAuthorizedAfterConfirmation = refreshedAuthorization.data === authorize;
        if (!isAuthorizedAfterConfirmation) {
          throw new Error('Morpho authorization was not confirmed on-chain.');
        }

        return true;
      } finally {
        setIsAuthorizing(false);
      }
    },
    [
      account,
      publicClient,
      isBundlerAuthorizationStatusReady,
      isBundlerAuthorized,
      authorized,
      sendBundlerAuthorizationTx,
      chainId,
      refetchIsBundlerAuthorized,
    ],
  );

  return {
    isBundlerAuthorized,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorizationReady,
    isAuthorizingBundler: isAuthorizing || isConfirmingBundlerTx,
    authorizeBundlerWithSignature,
    authorizeWithTransaction,
    refetchIsBundlerAuthorized,
  };
};
