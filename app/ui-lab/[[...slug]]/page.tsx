import { notFound } from 'next/navigation';
import { UiLabPageClient } from '@/features/ui-lab/ui-lab-page-client';

type UiLabPageProps = {
  params:
    | {
        slug?: string[];
      }
    | Promise<{
        slug?: string[];
      }>;
};

export default async function UiLabPage({ params }: UiLabPageProps) {
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_UI_LAB === 'true';

  if (!isEnabled) {
    notFound();
  }

  const resolvedParams = await Promise.resolve(params);

  return <UiLabPageClient initialSlug={resolvedParams.slug ?? []} />;
}
