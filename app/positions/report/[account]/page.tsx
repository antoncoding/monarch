import { Metadata } from 'next';
import { Address } from 'viem';
import ReportContent from '../components/ReportContent';

export const metadata: Metadata = {
  title: 'Position Report | Monarch',
  description: 'View your position report on Monarch',
};

export default function ReportPage({ params }: { params: { account: Address } }) {
  return <ReportContent account={params.account} />;
}
