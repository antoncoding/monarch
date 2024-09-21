import { Metadata } from 'next';
import HistoryContent from '../components/HistoryContent';

export const metadata: Metadata = {
  title: 'Transaction History | Monarch',
  description: 'View your transaction history on Monarch',
};

export default function HistoryPage({ params }: { params: { account: string } }) {
  return <HistoryContent account={params.account} />;
}
