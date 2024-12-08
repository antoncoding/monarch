'use client';

import Link from 'next/link';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useUserPositions from '@/hooks/useUserPositions';
import { HistoryTable } from './HistoryTable';

export default function HistoryContent({ account }: { account: string }) {
  const { loading, history } = useUserPositions(account);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="py-4 font-zen text-2xl">Transaction History</h1>

        {loading ? (
          <LoadingScreen message="Loading History..." />
        ) : history.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No transaction history available.
          </div>
        ) : (
          <div className="mt-4">
            <HistoryTable history={history} />
          </div>
        )}

        <div className="flex justify-center pt-14">
          <Link href={`/positions/${account}`}>
            <Button variant="solid" color="primary" className="px-10 py-4 font-zen" size="lg">
              Back to Portfolio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
