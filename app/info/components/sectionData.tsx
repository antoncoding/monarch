import React from 'react';
import logoImage from '../../../src/components/imgs/logo.png';
import monarchImage from '../../../src/imgs/intro/direct-supply.png';
import morphoImage from '../../../src/imgs/intro/morpho.png';
import vaultsImage from '../../../src/imgs/intro/vaults.png';

export const sections = [
  {
    mainTitle: 'Introducing Monarch',
    subTitle: 'Built on Morpho Blue',
    image: morphoImage,
    content: (
      <>
        <p>
          Monarch is an advanced interface for <span className="font-bold">Morpho Blue</span>, a
          decentralized, immutable, and neutral lending protocol. Morpho Blue allows anyone to lend
          and borrow assets without potential censorship, providing a foundation for decentralized
          finance.
        </p>
        <p className="mt-4">
          In the rapid development of DeFi, Morpho Blue stands out as a{' '}
          <a
            href="https://jacob.energy/hyperstructures.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-monarch-orange underline"
          >
            hyperstructure
          </a>
          , embodying the spirit of unstoppable, free, and valuable protocols. Built with a
          minimalistic, security-focused, and immutable approach, Morpho Blue is highly praised by
          the security community as one of the most efficient and secure protocols.
        </p>
        <p className="mt-4">
          As we explore Monarch, we'll start by understanding Morpho Blue and how Monarch enhances
          your interaction with this powerful hyperstructure.
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
        <p>
          The Morpho ecosystem introduces <span className="font-bold">Morpho Vaults</span>,
          intermediate contracts managed by curators to simplify risk management for normal
          suppliers.
        </p>
        <p className="mt-4">
          <span className="font-bold">Advantages:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Simplified user experience, managed risk exposure</li>
            <li>Easier to reuse the supplied liquidity as ERC4626 tokens.</li>
            <li>
              {' '}
              Learn more about{' '}
              <a
                href="https://docs.morpho.org/morpho-vaults/concepts/benefits-of-morpho-vaults/"
                target="_blank"
                className="text-monarch-orange underline"
              >
                Benefit of Morpho Vaults
              </a>{' '}
            </li>
          </ul>
        </p>
        <p className="mt-4">
          <span className="font-bold">Limitations:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Less control over lending parameter changes</li>
            <li>Limited customization options</li>
            <li>Potential performance fees</li>
          </ul>
        </p>
      </>
    ),
  },
  {
    mainTitle: 'Monarch: Empowering Advanced Users',
    subTitle: 'Direct Market Access',
    image: monarchImage,
    content: (
      <>
        <p>
          Monarch empowers advanced users by enabling{' '}
          <span className="font-bold">direct lending to markets</span>, bypassing the need for
          vaults. This approach offers greater control and customization over your lending
          positions.
        </p>
        <p className="mt-4">
          <span className="font-bold">Benefits:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Full control over lending parameters</li>
            <li>Customizable risk management</li>
            <li>No performance fees</li>
          </ul>
        </p>
        <p className="mt-4">
          <span className="font-bold">Considerations:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Deep understanding of market risks needed</li>
            <li>Currently requires manual rebalancing</li>
            <li>
              {' '}
              Learn more about the risks{' '}
              <a href="/risks" className="text-monarch-orange underline">
                {' '}
                here{' '}
              </a>{' '}
            </li>
          </ul>
        </p>
      </>
    ),
  },
  {
    mainTitle: 'The Future of Monarch',
    subTitle: 'Automation and Beyond',
    image: logoImage,
    customHeight: 200,
    content: (
      <>
        <p>
          <span className="font-bold">Coming Soon: Monarch Auto</span>
          <br />
          We're developing "Monarch Auto", a feature that will help automate the rebalancing process
          with your custom strategies. This will combine the benefits of direct market access with
          automated management.
        </p>
        <p className="mt-2">
          <span className="font-bold">What's in Progress:</span>
          <ul className="mt-2 list-inside list-disc">
            <li>Automated rebalancing strategies</li>
            <li>Enhanced risk management tools</li>
            <li>Improved user interface and experience</li>
          </ul>
        </p>
        <p className="mt-4">
          <span className="font-bold">We Value Your Feedback!</span>
          <br />
          Your input is crucial in shaping the future of Monarch. We encourage you to share your
          thoughts, suggestions, and any issues you encounter. Please send your feedback to
          <a href="https://t.me/+kM48_lzD9gQ3NzRl" className="text-monarch-orange underline">
            {' '}
            our telegram chat here{' '}
          </a>
        </p>
      </>
    ),
  },
];
