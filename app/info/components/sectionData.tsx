import React from 'react';
import logoImage from '../../../src/components/imgs/logo.png';
import monarchImage from '../../../src/imgs/intro/direct-supply.png';
import morphoImage from '../../../src/imgs/intro/morpho.png';
import vaultsImage from '../../../src/imgs/intro/vaults.png';

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-main flex-1 rounded-lg p-4 shadow">
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
            items={[
              'Requires market risk knowledge',
              'Manual rebalancing needed',
              'Higher complexity',
            ]}
          />
        </div>
      </>
    ),
  },
  {
    mainTitle: 'The Future of Monarch',
    subTitle: 'Automation and Beyond',
    image: logoImage,
    content: (
      <>
        <p>
          <span className="text-xl font-bold">Coming Soon: Monarch Auto</span>
          <br />
          We're developing "Monarch Auto" to automate the rebalancing process with custom
          strategies.
        </p>
        <p className="mt-4">
          <span className="font-bold">What's in Progress:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Automated rebalancing strategies</li>
            <li>Enhanced risk management tools</li>
            <li>Improved user interface</li>
          </ul>
        </p>
        <p className="mt-4">
          <span className="font-bold">We Value Your Feedback!</span>
          <br />
          Your input is crucial in shaping Monarch's future. Share your thoughts in our{' '}
          <a href="https://t.me/+kM48_lzD9gQ3NzRl" className="underline">
            Telegram chat
          </a>
          .
        </p>
      </>
    ),
  },
];
