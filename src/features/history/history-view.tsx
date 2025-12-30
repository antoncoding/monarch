'use client';

import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/header/Header';

import { HistoryTable } from './components/history-table';

export default function HistoryContent({ account }: { account: string }) {
  const searchParams = useSearchParams();
  const isVaultAdapter = searchParams.get('isVaultAdapter') === 'true';

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8 px-[4%] pb-20">
        <h1 className="py-4 font-zen text-2xl">Transaction History</h1>

        <div className="mt-4">
          <HistoryTable
            account={account}
            isVaultAdapter={isVaultAdapter}
          />
        </div>
      </div>
    </div>
  );
}
