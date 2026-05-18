import { generateMetadata as buildMetadata } from '@/utils/generateMetadata';
import VaultContent from '@/features/vault/vault-view';

export async function generateMetadata({ params }: { params: Promise<{ chainId: string; vaultAddress: string }> }) {
  const { chainId, vaultAddress } = await params;

  return buildMetadata({
    title: 'Vault | Monarch',
    description: 'Vault exposure, allocation caps, and market position detail',
    images: 'themes.png',
    pathname: `/vault/${chainId}/${vaultAddress}`,
  });
}

export default function VaultPage() {
  return <VaultContent />;
}
