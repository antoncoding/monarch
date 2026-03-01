import { useCallback } from 'react';
import type { Address } from 'viem';
import { useMorphoAuthorization } from './useMorphoAuthorization';

type AuthorizationMode = 'signature' | 'transaction';

type EnsureBundlerAuthorizationParams = {
  mode: AuthorizationMode;
};

type UseBundlerAuthorizationStepParams = {
  chainId: number;
  bundlerAddress: Address;
};

type EnsureBundlerAuthorizationResult = {
  authorized: boolean;
  authorizationTxData: `0x${string}` | null;
};

export const useBundlerAuthorizationStep = ({ chainId, bundlerAddress }: UseBundlerAuthorizationStepParams) => {
  const {
    isBundlerAuthorized,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorizationReady,
    isAuthorizingBundler,
    authorizeBundlerWithSignature,
    authorizeWithTransaction,
    refetchIsBundlerAuthorized,
  } = useMorphoAuthorization({
    chainId,
    authorized: bundlerAddress,
  });

  const ensureBundlerAuthorization = useCallback(
    async ({ mode }: EnsureBundlerAuthorizationParams): Promise<EnsureBundlerAuthorizationResult> => {
      if (isBundlerAuthorized === true) {
        return {
          authorized: true,
          authorizationTxData: null,
        };
      }

      if (mode === 'signature') {
        if (!isBundlerAuthorizationReady) {
          throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
        }
        const authorizationTxData = await authorizeBundlerWithSignature();
        if (authorizationTxData) {
          return {
            authorized: true,
            authorizationTxData: authorizationTxData as `0x${string}`,
          };
        }

        const refreshedAuthorization = await refetchIsBundlerAuthorized();
        return {
          authorized: refreshedAuthorization.data === true,
          authorizationTxData: null,
        };
      }

      if (!isBundlerAuthorizationStatusReady) {
        throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
      }

      const authorized = await authorizeWithTransaction();
      return {
        authorized,
        authorizationTxData: null,
      };
    },
    [
      isBundlerAuthorized,
      isBundlerAuthorizationReady,
      isBundlerAuthorizationStatusReady,
      authorizeBundlerWithSignature,
      authorizeWithTransaction,
      refetchIsBundlerAuthorized,
    ],
  );

  return {
    isBundlerAuthorized,
    isBundlerAuthorizationStatusReady,
    isBundlerAuthorizationReady,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  };
};
