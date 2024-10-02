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
          <span className="font-bold">Morpho Blue</span> is the core protocol of the Morpho
          ecosystem. It's a decentralized, immutable, and neutral lending protocol that enables the
          creation of lending markets with any assets in a truly decentralized manner. As a{' '}
          <a
            href="https://jacob.energy/hyperstructures.html"
            target="_blank"
            rel="noopener noreferrer"
            class="text-monarch-primary underline"
          >
            hyperstructure
          </a>
          , Morpho Blue embodies unstoppable, free, and neutral DeFi primitives.
        </p>
        <p className="mt-4">
          Built with a minimalistic and unopinionated approach, Morpho Blue is the foundation upon
          which the entire Morpho ecosystem is constructed. Its efficiency and security have made it
          highly regarded in the DeFi community, positioning it as the most crucial element in
          Morpho's architecture.
        </p>
        <p className="mt-4">
          Monarch serves as an advanced interface for Morpho Blue, providing users with a gateway to
          interact with this powerful core protocol. As we explore Morpho's ecosystem, understanding
          Morpho Blue is essential, as it underpins all other components and functionalities.
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
          The Morpho Lab team introduces <span className="font-bold">Morpho Vaults</span>,
          intermediate contracts managed by curators to simplify risk management for normal
          suppliers. This is the recommended way to interact with Morpho Blue, as it offers a more
          user-friendly experience and simplified risk management.
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
                className="text-monarch-primary underline"
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
          <span className="font-bold">direct lending to Morpho Blue markets</span>, bypassing the
          need for vaults. This approach offers greater control and customization over your lending
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
            <li className="font-bold">
              {' '}
              Learn more about the risks{' '}
              <a href="/info/risks" className="text-monarch-primary underline">
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
          <span className="text-xl font-bold">Coming Soon: Monarch Auto</span>
          <br />
          We're developing "Monarch Auto", a feature that will help automate the rebalancing process
          with your custom strategies. This will combine the benefits of direct market access with
          automated management.
        </p>
        <p className="mt-4">
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
          <a href="https://t.me/+kM48_lzD9gQ3NzRl" className="underline">
            {' '}
            our telegram chat here{' '}
          </a>
        </p>
      </>
    ),
  },
];
