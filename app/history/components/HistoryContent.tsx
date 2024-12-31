'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/common/Button';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useUserTransactions from '@/hooks/useUserTransactions';
import { useUserRebalancerInfo } from '@/hooks/useUserRebalancerInfo';
import { UserTransaction } from '@/utils/types';
import { HistoryTable } from './HistoryTable';

export default function HistoryContent({ account }: { account: string }) {
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { loading, error, fetchTransactions } = useUserTransactions();
  const { rebalancerInfo } = useUserRebalancerInfo(account);

  useEffect(() => {
    const loadTransactions = async () => {
      const result = await fetchTransactions({
        userAddress: [account],
        page: currentPage,
        pageSize,
      });

      if (result) {
        setTransactions(result.items);
        setTotalCount(result.pageInfo.countTotal);
      }
    };

    void loadTransactions();
  }, [account, currentPage, fetchTransactions]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (error) {
    return (
      <div className="flex flex-col justify-between font-zen">
        <Header />
        <div className="container gap-8 px-[5%]">
          <div className="w-full items-center rounded-md p-12 text-center text-red-500">
            Error loading transaction history. Please try again later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container gap-8 px-[5%]">
        <h1 className="py-4 font-zen text-2xl">Transaction History</h1>

        {loading ? (
          <LoadingScreen message="Loading History..." />
        ) : transactions.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No transaction history available.
          </div>
        ) : (
          <div className="mt-4">
            <HistoryTable 
              history={transactions} 
              rebalancerInfo={rebalancerInfo} 
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / pageSize)}
              onPageChange={handlePageChange}
            />
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
