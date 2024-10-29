'use client';

import Link from 'next/link';
import Header from '@/components/layout/header/Header';

const riskSections = [
  {
    mainTitle: 'Liquidity Management',
    subTitle: 'Keep an eye on illiquid markets',
    content: (
      <>
        <p>When supplying directly to markets, you are responsible for:</p>
        <ul className="mt-2 list-inside list-disc">
          <li>
            Managing partial fund availability for withdrawal during periods of high market
            utilization
          </li>
          <li>Actively monitoring and managing liquidity across different markets</li>
        </ul>
      </>
    ),
  },
  {
    mainTitle: 'Risk Management',
    subTitle: 'Active Monitoring Required',
    content: (
      <>
        <p>Direct market positions require you to take charge of risk management:</p>
        <ul className="mt-2 list-inside list-disc">
          <li>
            Rebalance between markets with different LLTVs / oracles to adjust collateral exposure
          </li>
          <li>Regularly assessing and adjusting positions based on market conditions</li>
        </ul>
      </>
    ),
  },
  {
    mainTitle: 'APY Optimization',
    subTitle: 'Optimizing Your Lending Strategy',
    content: (
      <>
        <p>Optimizing returns through direct lending becomes your responsibility:</p>
        <ul className="mt-2 list-inside list-disc">
          <li>Actively managing market changes based on borrowing activities</li>
          <li>Performing regular rebalancing to maximize yields</li>
        </ul>
      </>
    ),
  },
];

function RiskPage() {
  return (
    <div className="flex min-h-screen flex-col font-zen">
      <Header />
      <main className="container mx-auto flex flex-grow flex-col py-8 md:px-32">
        <h1 className="mb-2 text-3xl font-bold">Understanding The Risks</h1>

        <p className="mb-2 text-secondary">
          This page covers advanced topics. For a comprehensive overview of Monarch, please visit
          our{' '}
          <Link href="/info" className="text-primary underline">
            introduction page
          </Link>
          .
        </p>

        <p className="mb-8 text-secondary">
          When choosing direct lending over vaults, you gain more control but also take on more
          responsibilities. The following aspects become{' '}
          <span className="font-bold text-primary">your direct responsibility</span>:
        </p>

        {riskSections.map((section) => (
          <div key={section.mainTitle} className="mb-8">
            <h2 className="text-2xl font-semibold">{section.mainTitle}</h2>
            <h3 className="mb-4 text-lg text-secondary">{section.subTitle}</h3>
            <div className="text-normal">{section.content}</div>
          </div>
        ))}

        <p className="mt-6 rounded-md border-2 border-dashed border-primary p-4 font-zen text-sm text-secondary">
          While these responsibilities require more active management, they also offer opportunities
          for advanced users to optimize their lending strategies. Always conduct your own research
          and ensure you're prepared to handle these responsibilities before engaging in direct
          market lending.
        </p>
      </main>
    </div>
  );
}

export default RiskPage;
