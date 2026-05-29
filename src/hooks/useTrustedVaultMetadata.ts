import { useMemo } from 'react';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { useAllMorphoVaultsQuery } from '@/hooks/queries/useAllMorphoVaultsQuery';
import { useMorphoVaultV2MetadataQuery } from '@/hooks/queries/useMorphoVaultV2MetadataQuery';
import { buildTrustedVaultMap, buildTrustedVaultMetadata, morphoVaultV2MetadataToTrustedVault } from '@/utils/vaults';

type UseTrustedVaultMetadataOptions = {
  enabled?: boolean;
  trustedVaults: TrustedVault[];
};

export function useTrustedVaultMetadata({ enabled = true, trustedVaults }: UseTrustedVaultMetadataOptions) {
  const shouldFetch = enabled && trustedVaults.length > 0;
  const { data: morphoVaults = [] } = useAllMorphoVaultsQuery({ enabled: shouldFetch });
  const trustedVaultMetadataRequests = useMemo(
    () => trustedVaults.map((vault) => ({ address: vault.address, chainId: vault.chainId })),
    [trustedVaults],
  );
  const { data: morphoV2VaultMetadata = [] } = useMorphoVaultV2MetadataQuery({
    enabled: shouldFetch,
    vaults: trustedVaultMetadataRequests,
  });

  const trustedV2VaultMetadata = useMemo(() => morphoV2VaultMetadata.map(morphoVaultV2MetadataToTrustedVault), [morphoV2VaultMetadata]);
  const trustedVaultMetadata = useMemo(
    () => buildTrustedVaultMetadata(morphoVaults, trustedV2VaultMetadata),
    [morphoVaults, trustedV2VaultMetadata],
  );
  const trustedVaultMap = useMemo(() => buildTrustedVaultMap(trustedVaults, trustedVaultMetadata), [trustedVaults, trustedVaultMetadata]);

  return {
    trustedVaultMap,
  };
}
