import { useCallback } from 'react';
import type { Address } from 'viem';
import { type MorphoAuthorizationSignatureData, useMorphoAuthorization } from './useMorphoAuthorization';

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
  authorizationSignatureData: MorphoAuthorizationSignatureData | null;
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
          authorizationSignatureData: null,
        };
      }

      if (mode === 'signature') {
        if (!isBundlerAuthorizationReady) {
          throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
        }
        const authorizationSignatureData = await authorizeBundlerWithSignature();
        if (authorizationSignatureData) {
          return {
            authorized: true,
            authorizationTxData: authorizationSignatureData.authorizationTxData,
            authorizationSignatureData,
          };
        }

        const refreshedAuthorization = await refetchIsBundlerAuthorized();
        return {
          authorized: refreshedAuthorization.data === true,
          authorizationTxData: null,
          authorizationSignatureData: null,
        };
      }

      if (!isBundlerAuthorizationStatusReady) {
        throw new Error('Morpho authorization is still loading. Please wait a moment and try again.');
      }

      const authorized = await authorizeWithTransaction();
      return {
        authorized,
        authorizationTxData: null,
        authorizationSignatureData: null,
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
