import type { Metadata } from 'next';
import type { Address } from 'viem';
import ReportContent from '../components/ReportContent';

export const metadata: Metadata = {
  title: 'Position Report | Monarch',
  description: 'View your position report on Monarch',
};

export default async function ReportPage({ params }: { params: Promise<{ account: Address }> }) {
  const p = await params;
  return <ReportContent account={p.account} />;
}
