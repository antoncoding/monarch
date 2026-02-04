import type { Metadata } from 'next';
import PositionDetailContent from '@/features/position-detail/position-view';

export const metadata: Metadata = {
  title: 'Position Detail | Monarch',
  description: 'View detailed position information on Monarch',
};

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; loanAsset: string; userAddress: string }>;
}) {
  const p = await params;
  return (
    <PositionDetailContent
      chainId={Number(p.chainId)}
      loanAsset={p.loanAsset}
      userAddress={p.userAddress}
    />
  );
}
