import { notFound } from 'next/navigation';

type UiLabPageProps = {
  params?: Promise<{
    slug?: string[];
  }>;
};

export default async function UiLabPage({ params }: UiLabPageProps) {
  const isEnabled =
    process.env.NODE_ENV !== 'production' &&
    (process.env.ENABLE_UI_LAB === 'true' || process.env.NEXT_PUBLIC_ENABLE_UI_LAB === 'true');

  if (!isEnabled) {
    notFound();
  }

  const { UiLabPageClient } = await import('@/features/ui-lab/ui-lab-page-client');
  const resolvedParams = params ? await params : undefined;

  return <UiLabPageClient initialSlug={resolvedParams?.slug ?? []} />;
}
