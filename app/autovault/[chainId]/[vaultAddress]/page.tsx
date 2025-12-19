import { generateMetadata as buildMetadata } from '@/utils/generateMetadata';

import VaultContent from '../../../../src/features/autovault/vault-view';

export async function generateMetadata({ params }: { params: Promise<{ chainId: string; vaultAddress: string }> }) {
  const { chainId, vaultAddress } = await params;

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
