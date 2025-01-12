import React from 'react';
import { EXTERNAL_LINKS } from '@/utils/external';
import monarchAgentImg from '../../../src/imgs/agent/agent.png';
import monarchImage from '../../../src/imgs/intro/direct-supply.png';
import morphoImage from '../../../src/imgs/intro/morpho.png';
import vaultsImage from '../../../src/imgs/intro/vaults.png';

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-main flex-1 rounded p-4 shadow">
      <h3 className="mb-2 font-zen text-lg font-bold">{title}</h3>
      <ul className="list-inside list-disc">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export const sections = [
  {
    mainTitle: 'Introducing Monarch',
    subTitle: 'Built on Morpho Blue',
    image: morphoImage,
    content: (
      <>
        <p>
          <span className="font-bold">Morpho Blue</span> is the core protocol of the Morpho
          ecosystem. It's a decentralized, immutable, and neutral lending protocol that enables the
          creation of lending markets with any assets in a truly decentralized manner.
        </p>
        <p className="mt-4">
          Built with a minimalistic approach, Morpho Blue is the foundation of the entire Morpho
          ecosystem. Its efficiency and security have made it highly regarded in the DeFi community.
        </p>
        <p className="mt-4">
          Monarch serves as an advanced interface for Morpho Blue, providing users with a gateway to
          interact with this powerful core protocol.
        </p>
      </>
    ),
  },
  {
    mainTitle: 'Understanding the Ecosystem',
    subTitle: 'Morpho Vaults',
    image: vaultsImage,
    content: (
      <>
        <p className="mb-4">
          The Morpho Lab team introduces <span className="font-bold">Morpho Vaults</span>,
          intermediate contracts managed by curators to simplify risk management for normal
          suppliers.
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row">
          <Card
            title="Advantages"
            items={[
              'Simplified user experience',
              'Managed risk exposure',
              'ERC4626 token compatibility',
            ]}
          />
          <Card
            title="Limitations"
            items={[
              'Less control over parameters',
              'Limited customization',
              'Potential performance fees',
            ]}
          />
        </div>
      </>
    ),
  },
  {
    mainTitle: 'Monarch: Empowering Advanced Users',
    subTitle: 'Direct Market Access',
    image: monarchImage,
    content: (
      <>
        <p className="mb-4">
          Monarch empowers advanced users by enabling{' '}
          <span className="font-bold">direct lending to Morpho Blue markets</span>, bypassing the
          need for vaults.
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row">
          <Card
            title="Benefits"
            items={[
              'Full control over parameters',
              'Customizable risk management',
              'No performance fees',
            ]}
          />
          <Card
            title="Considerations"
            items={['Requires market risk knowledge', 'Higher complexity']}
          />
        </div>
      </>
    ),
  },
  {
    mainTitle: 'Monarch Agent',
    subTitle: 'Automated Position Management',
    image: monarchAgentImg,
    isNew: true,
    content: (
      <>
        <p>
          <span className="text-xl font-bold">Introducing Monarch Agent</span>
          <br />
          The Monarch Agent is your personal companion that helps optimize your lending strategy
          across Morpho Blue markets.
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row">
          <Card
            title="Key Features"
            items={[
              'Automated position rebalancing',
              'Customizable market caps',
              'Granular market authorization',
              'Risk-controlled automation',
            ]}
          />
          <Card
            title="How It Works"
            items={[
              'Select markets to authorize',
              'Set maximum allocation caps',
              'Agent optimizes within limits',
              'Modify permissions anytime',
            ]}
          />
        </div>
        <p className="mt-4">
          <span className="font-bold">We Value Your Feedback!</span>
          <br />
          Your input is crucial in shaping Monarch's future. Share your thoughts in our{' '}
          <a href={EXTERNAL_LINKS.discord} className="underline" target="_blank">
            Discord
          </a>
          .
        </p>
      </>
    ),
  },
];
