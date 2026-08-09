'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import Header from '@/components/layout/header/Header';
import { Button } from '@/components/ui/button';
import { PortfolioAccountPreview } from '@/features/portfolios/components/portfolio-account-preview';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { useModal } from '@/hooks/useModal';
import EmptyScreen from '@/components/status/empty-screen';

export default function PortfoliosLandingView() {
  const router = useRouter();
  const portfolios = useLocalPortfolios((state) => state.portfolios);
  const deletePortfolio = useLocalPortfolios((state) => state.deletePortfolio);
  const { open } = useModal();

  const openCreatePortfolio = () => {
    open('createPortfolio', { onCreated: (portfolioSlug) => router.push(`/portfolios/${portfolioSlug}`) });
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full pb-12">
        <div className="mt-6">
          <PositionBreadcrumbs
            showPosition={false}
            rootLabel="Portfolios"
            rootHref="/portfolios"
            placeholderLabel="Local portfolios"
          />
        </div>

        <div className="mt-6 flex max-w-[720px] items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-medium text-primary">Portfolios</h1>
            <p className="mt-1 text-sm text-secondary">Named account groups stored only in this browser.</p>
          </div>
          {portfolios.length > 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={openCreatePortfolio}
            >
              <PlusIcon />
              Create portfolio
            </Button>
          )}
        </div>

        {portfolios.length === 0 ? (
          <EmptyScreen
            message="No local portfolios yet."
            hint="Create one, then add accounts from any account menu."
            className="mt-6 max-w-[720px]"
            action={
              <Button
                variant="primary"
                size="md"
                onClick={openCreatePortfolio}
              >
                <PlusIcon />
                Create portfolio
              </Button>
            }
          />
        ) : (
          <div className="mt-6 max-w-[720px] rounded border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-medium text-secondary">Saved portfolios</h2>
            <div className="mt-3 space-y-2">
              {portfolios.map((portfolio) => (
                <div
                  key={portfolio.slug}
                  className="flex items-center justify-between gap-3 rounded border border-border/60 bg-background px-3 py-2"
                >
                  <Link
                    href={`/portfolios/${portfolio.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline hover:no-underline"
                  >
                    <PortfolioAccountPreview accounts={portfolio.accounts} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">{portfolio.name}</div>
                      <div className="text-xs text-secondary">
                        {portfolio.accounts.length} {portfolio.accounts.length === 1 ? 'account' : 'accounts'}
                      </div>
                    </div>
                    <ArrowRightIcon className="ml-auto h-4 w-4 text-secondary" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 px-2 text-secondary"
                    aria-label={`Delete ${portfolio.name}`}
                    onClick={() => deletePortfolio(portfolio.slug)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
