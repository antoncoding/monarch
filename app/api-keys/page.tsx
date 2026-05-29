import { ApiKeyConsoleView } from '@/features/api-keys/api-key-console-view';
import { generateMetadata } from '@/utils/generateMetadata';

export const metadata = generateMetadata({
  title: 'API Keys | Monarch',
  description: 'Generate Monarch API keys',
  images: 'themes.png',
  pathname: '/api-keys',
});

export default function ApiKeysPage() {
  return <ApiKeyConsoleView />;
}
