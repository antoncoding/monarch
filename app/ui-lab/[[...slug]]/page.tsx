import { notFound } from 'next/navigation';
import { UiLabPageClient } from '@/features/ui-lab/ui-lab-page-client';

type UiLabPageProps = {
  params?: Promise<{
    slug?: string[];
  }>;
};

export default async function UiLabPage({ params }: UiLabPageProps) {
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_UI_LAB === 'true';

  if (!isEnabled) {
    notFound();
  }

  const resolvedParams = params ? await params : undefined;

  return <UiLabPageClient initialSlug={resolvedParams?.slug ?? []} />;
}
