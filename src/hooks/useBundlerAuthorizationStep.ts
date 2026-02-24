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
  const { isBundlerAuthorized, isAuthorizingBundler, authorizeBundlerWithSignature, authorizeWithTransaction, refetchIsBundlerAuthorized } =
    useMorphoAuthorization({
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

      const authorized = await authorizeWithTransaction();
      return {
        authorized,
        authorizationTxData: null,
      };
    },
    [isBundlerAuthorized, authorizeBundlerWithSignature, authorizeWithTransaction, refetchIsBundlerAuthorized],
  );

  return {
    isBundlerAuthorized,
    isAuthorizingBundler,
    ensureBundlerAuthorization,
    refetchIsBundlerAuthorized,
  };
};
