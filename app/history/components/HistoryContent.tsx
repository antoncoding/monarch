'use client';

import Header from '@/components/layout/header/Header';
import useUserPositions from '@/hooks/useUserPositions';
import { useUserRebalancerInfo } from '@/hooks/useUserRebalancerInfo';
import { HistoryTable } from './HistoryTable';

export default function HistoryContent({ account }: { account: string }) {
  const { data: positions } = useUserPositions(account, true);

  const { rebalancerInfo } = useUserRebalancerInfo(account);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8 px-[5%]">
        <h1 className="py-4 font-zen text-2xl">Transaction History</h1>

        <div className="mt-4">
          <HistoryTable account={account} positions={positions} rebalancerInfo={rebalancerInfo} />
        </div>
      </div>
    </div>
  );
}
