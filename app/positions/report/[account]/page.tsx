import { Metadata } from 'next';
import ReportContent from '../components/ReportContent';
import { Address } from 'viem';

export const metadata: Metadata = {
  title: 'Position Report | Monarch',
  description: 'View your position report on Monarch',
};

export default function ReportPage({ params }: { params: { account: Address } }) {
  return <ReportContent account={params.account} />;
}
