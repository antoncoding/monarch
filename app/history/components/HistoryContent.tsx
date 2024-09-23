'use client';

import { ToastContainer } from 'react-toastify';
import PrimaryButton from '@/components/common/PrimaryButton';
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
          <PrimaryButton href={`/positions/${account}`}>Back to Portfolio</PrimaryButton>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
