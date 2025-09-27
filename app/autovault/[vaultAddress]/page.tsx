import { generateMetadata } from '@/utils/generateMetadata';

import VaultContent from './content';

export const metadata = generateMetadata({
  title: 'Vault Details | Monarch',
  description: 'Detailed information about a specific autovault',
  images: 'themes.png',
  pathname: '',
});

export default function VaultPage() {
  return <VaultContent />;
}
