import { generateMetadata as buildMetadata } from '@/utils/generateMetadata';

import VaultContent from './content';

export async function generateMetadata({
  params,
}: {
  params: { chainId: string; vaultAddress: string };
}) {
  const { chainId, vaultAddress } = params;

  return buildMetadata({
    title: 'Vault Details | Monarch',
    description: 'Detailed information about a specific autovault',
    images: 'themes.png',
    pathname: `/autovault/${chainId}/${vaultAddress}`,
  });
}

export default function VaultPage() {
  return <VaultContent />;
}
