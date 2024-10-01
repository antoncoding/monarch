'use client';

import Header from '@/components/layout/header/Header';
/**
 */
function InfoPage() {
  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container flex h-full flex-col gap-4" style={{ padding: '0 5%' }}>
        <h1 className="py-8 font-zen"> Why Monarch </h1>

        <h2 className="font-zen text-2xl">Morpho Protocol</h2>
        <p className="font-secondary">
          Morpho is one of the most decentralized, neutral and efficient lending{' '}
          <span className="font-bold">primitive</span>
        </p>

        <h2 className="font-zen text-2xl"> Mission </h2>
        <p>The mission of monarch lend is to become</p>
      </div>
    </div>
  );
}

export default InfoPage;
