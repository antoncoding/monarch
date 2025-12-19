import type { Metadata } from 'next';
import HistoryContent from '@/features/history/history-view';

export const metadata: Metadata = {
  title: 'Transaction History | Monarch',
  description: 'View your transaction history on Monarch',
};

export default async function HistoryPage({ params }: { params: Promise<{ account: string }> }) {
  const p = await params;
  return <HistoryContent account={p.account} />;
}
