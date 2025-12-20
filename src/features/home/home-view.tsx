'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { RiBookLine, RiDiscordFill, RiGithubFill, RiArrowDownLine, RiExternalLinkLine } from 'react-icons/ri';
import RebalanceAnimation from '@/components/animations/RebalanceAnimation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { EXTERNAL_LINKS } from '@/utils/external';
import logo from '@/components/imgs/logo.png';
import morphoLogoDark from '@/imgs/intro/morpho-logo-darkmode.svg';
import morphoLogoLight from '@/imgs/intro/morpho-logo-lightmode.svg';
import vaultImage from '@/imgs/intro/vault.webp';

import { CustomTypingAnimation } from './typing-title';

function HomePage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-main min-h-screen font-zen">
      <Header ghost />
      <main className="mx-auto w-full">
        {/* Hero Section - Full Screen */}
        <section className="relative flex min-h-screen flex-col justify-between">
          <div className="container mx-auto flex flex-1 flex-col items-center justify-center px-6 sm:px-8 md:px-12">
            <div className="flex w-full flex-col items-center md:-mt-[5vh]">
              <div className="flex w-full flex-col items-center">
                {/* Logo and Product Title - Horizontal Layout */}
                <div className="mb-4 inline-flex items-center gap-2 sm:mb-6 sm:gap-3 md:mb-8 md:gap-4">
                  <h1
                    className="m-0 font-zen text-3xl leading-none text-primary sm:text-3xl md:text-4xl"
                    style={{ padding: 0 }}
                  >
                    Welcome to Monarch
                  </h1>
                  <Image
                    src={logo}
                    alt="Monarch Logo"
                    width={60}
                    height={60}
                    className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14"
                  />
                </div>

                {/* Tagline with typing animation */}
                <div className="w-full max-w-xl px-2 sm:max-w-2xl sm:px-4">
                  <div className="mb-6 flex h-[4.5rem] flex-col items-center justify-start sm:mb-8 sm:h-[5rem] md:mb-10 md:h-[6rem] md:items-start md:pl-20">
                    <CustomTypingAnimation />
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mx-auto flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <Button
                  variant="default"
                  className="flex w-auto min-w-[200px] items-center justify-center gap-2 px-8 py-3 font-zen sm:px-10 sm:py-4"
                  size="lg"
                  onClick={() => scrollToSection('section-1')}
                >
                  Learn More
                  <RiArrowDownLine className="h-5 w-5" />
                </Button>
                <Link
                  href="/markets"
                  className="block no-underline"
                >
                  <Button
                    variant="primary"
                    className="w-auto min-w-[200px] px-8 py-3 font-zen sm:px-10 sm:py-4"
                    size="lg"
                  >
                    Explore Markets
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll indicator - centered and subtle */}
          <div className="flex w-full justify-center pb-8">
            <svg
              className="h-6 w-6 animate-bounce text-secondary opacity-30"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* Section 1: Introducing Monarch - Full Screen, Left Layout with Image */}
        <section
          id="section-1"
          className="flex w-full items-center bg-surface py-12 md:min-h-screen md:py-24"
        >
          <div className="container mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto grid max-w-7xl items-center gap-8 md:gap-12 md:grid-cols-[2fr_1fr]">
              {/* Text Content */}
              <div>
                <h2 className="mb-4 font-zen text-2xl text-primary sm:mb-6 sm:text-3xl md:text-4xl">Introducing Monarch</h2>
                <p className="mb-4 text-lg text-secondary sm:mb-6 sm:text-xl md:text-2xl">Advanced Interface for Morpho Blue</p>
                <div className="space-y-4 sm:space-y-6">
                  <p className="text-base leading-relaxed sm:text-lg">
                    Morpho Blue is the core protocol of the Morpho ecosystem—a decentralized, immutable, and neutral lending protocol that
                    enables the creation of lending markets with any assets.
                  </p>
                  <p className="text-base leading-relaxed sm:text-lg">
                    Monarch is an advanced interface for Morpho Blue, providing powerful tools to interact directly with the protocol—from
                    simple lending to creating your own automated vaults.
                  </p>
                </div>
                <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                  <a
                    href="https://docs.morpho.org/learn/concepts/market/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block no-underline"
                  >
                    <Button
                      variant="default"
                      size="lg"
                      className="font-zen flex w-auto min-w-[280px] items-center justify-center gap-2"
                    >
                      More about Morpho Blue
                      <RiExternalLinkLine className="h-5 w-5" />
                    </Button>
                  </a>
                  <Button
                    variant="primary"
                    size="lg"
                    className="font-zen flex w-auto min-w-[280px] items-center justify-center gap-2"
                    onClick={() => scrollToSection('section-2')}
                  >
                    Continue
                    <RiArrowDownLine className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Morpho Logo */}
              <div className="hidden items-center justify-center sm:flex">
                <Image
                  src={mounted && theme === 'dark' ? morphoLogoDark : morphoLogoLight}
                  alt="Morpho Logo"
                  width={180}
                  height={180}
                  className="h-32 w-32 md:h-[180px] md:w-[180px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Morpho Vaults - Full Screen, Right Layout with Image */}
        <section
          id="section-2"
          className="flex w-full items-center bg-main py-12 md:min-h-screen md:py-24"
        >
          <div className="container mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto grid max-w-7xl items-center gap-8 md:gap-12 md:grid-cols-[2fr_1fr] md:grid-flow-dense">
              {/* Text Content */}
              <div className="md:col-start-1">
                <h2 className="mb-4 font-zen text-2xl text-primary sm:mb-6 sm:text-3xl md:text-4xl">Morpho Vaults</h2>
                <p className="mb-4 text-lg text-secondary sm:mb-6 sm:text-xl md:text-2xl">Curated Risk Management</p>
                <div className="space-y-4 sm:space-y-6">
                  <p className="text-base leading-relaxed sm:text-lg">
                    Morpho Vaults are intermediate contracts managed by professional risk curators who simplify risk management for
                    suppliers. These vaults provide a simplified user experience with managed risk exposure and ERC4626 token compatibility.
                  </p>
                  <p className="text-base leading-relaxed sm:text-lg">
                    However, they come with trade-offs: less control over parameters, limited customization, and potential performance fees
                    charged by curators.
                  </p>
                </div>
                <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                  <a
                    href="https://docs.morpho.org/curate/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block no-underline"
                  >
                    <Button
                      variant="default"
                      size="lg"
                      className="font-zen flex w-auto min-w-[280px] items-center justify-center gap-2"
                    >
                      More about Risk Curation
                      <RiExternalLinkLine className="h-5 w-5" />
                    </Button>
                  </a>
                  <Button
                    variant="primary"
                    size="lg"
                    className="font-zen flex w-auto min-w-[280px] items-center justify-center gap-2"
                    onClick={() => scrollToSection('section-3')}
                  >
                    Why Monarch
                    <RiArrowDownLine className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Vault Image */}
              <div className="hidden items-center justify-center sm:flex md:col-start-2">
                <Image
                  src={vaultImage}
                  alt="Morpho Vaults"
                  width={200}
                  height={200}
                  className="h-32 w-32 rounded-lg md:h-[200px] md:w-[200px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Direct Market Access - Full Screen, Left Layout with Animation */}
        <section
          id="section-3"
          className="flex w-full items-center bg-surface py-12 md:min-h-screen md:py-24"
        >
          <div className="container mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto max-w-7xl">
              {/* Text Content - Centered */}
              <div className="mb-8 text-center sm:mb-12">
                <h2 className="mb-4 font-zen text-2xl text-primary sm:mb-6 sm:text-3xl md:text-4xl">Why Monarch?</h2>
                <p className="mb-4 text-lg text-secondary sm:mb-6 sm:text-xl md:text-2xl">Advanced Tools for DeFi Power Users</p>
                <div className="mx-auto max-w-3xl space-y-4 text-left sm:space-y-6">
                  <p className="text-base leading-relaxed sm:text-lg">
                    Monarch provides direct access to Morpho Blue markets with no intermediaries and zero fees. Our powerful tools are
                    designed for sophisticated users who want maximum control and capital efficiency:
                  </p>
                  <ul className="space-y-3 text-base leading-relaxed sm:space-y-4 sm:text-lg">
                    <li className="flex gap-2 sm:gap-3">
                      <span className="text-monarch-orange">•</span>
                      <span>
                        <strong>Market Discovery:</strong> Find the best lending opportunities with the highest APY while understanding the
                        risk trade-offs.
                      </span>
                    </li>
                    <li className="flex gap-2 sm:gap-3">
                      <span className="text-monarch-orange">•</span>
                      <span>
                        <strong>Risk Analysis:</strong> Comprehensive risk metrics and analytics on every market, helping you make informed
                        decisions.
                      </span>
                    </li>
                    <li className="flex gap-2 sm:gap-3">
                      <span className="text-monarch-orange">•</span>
                      <span>
                        <strong>Smart Rebalancing:</strong> Tools designed to help you identify optimal yield opportunities and easily
                        rebalance your positions across multiple markets.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Rebalance Animation */}
              <div className="mb-8 flex items-center justify-center sm:mb-12">
                <RebalanceAnimation />
              </div>

              {/* CTA Buttons - Centered */}
              <div className="mx-auto flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Button
                  variant="default"
                  size="lg"
                  className="w-auto min-w-[200px] cursor-not-allowed font-zen opacity-50"
                  disabled
                >
                  Auto Vault <Badge variant="success"> Coming Soon </Badge>
                </Button>
                <Link
                  href="/markets"
                  className="block no-underline"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-auto min-w-[200px] font-zen"
                  >
                    Explore Markets
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Auto Vaults - Full Screen, Center Layout, No Image */}
        {/* <section className="flex min-h-screen w-full items-center bg-main py-16 md:py-24">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex items-center justify-center gap-3">
                <h2 className="font-zen text-4xl text-primary">
                  Auto Vaults
                </h2>
                <Badge variant="success" size="lg">
                  New
                </Badge>
              </div>
              <p className="mb-8 text-2xl text-secondary">
                Be Your Own Risk Curator
              </p>

              <div className="space-y-8">
                <p className="text-xl leading-relaxed text-secondary">
                  Deploy your own vault. Define your risk parameters. Keep full control.
                </p>

                <div className="space-y-6 text-left">
                  <div className="flex items-start gap-4">
                    <span className="font-zen text-3xl text-monarch-orange">1</span>
                    <div>
                      <h4 className="mb-2 font-zen text-xl text-primary">Deploy Your Vault</h4>
                      <p className="text-lg text-secondary">
                        Launch your own vault contract with just a few clicks. No technical expertise required.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="font-zen text-3xl text-monarch-orange">2</span>
                    <div>
                      <h4 className="mb-2 font-zen text-xl text-primary">Full Control</h4>
                      <p className="text-lg text-secondary">
                        Set your own risk parameters, choose markets, define caps. You're the curator. No performance fees, no middlemen.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="font-zen text-3xl text-monarch-orange">3</span>
                    <div>
                      <h4 className="mb-2 font-zen text-xl text-primary">Automated Optimization</h4>
                      <p className="text-lg text-secondary">
                        Choose automation agents that work within your rules to optimize yields automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <Link href="/autovault">
                  <Button variant="primary" size="lg" className="px-12 py-4 font-zen">
                    Create Auto Vault
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section> */}

        {/* Footer CTA - Full Screen */}
        <section className="flex min-h-screen w-full flex-col items-center justify-center bg-main py-16 text-center md:py-24">
          <div className="container mx-auto px-6 sm:px-8 md:px-12">
            <h2 className="mb-4 font-zen text-2xl text-primary sm:mb-6 sm:text-3xl md:text-4xl">Join the Monarch Community</h2>
            <p className="mx-auto mb-8 max-w-2xl text-base text-secondary sm:mb-12 sm:text-xl md:text-2xl">
              Connect with us and stay updated on the latest features and developments in decentralized lending.
            </p>

            {/* Social Links - Fixed underscores */}
            <div className="flex items-center justify-center gap-6">
              <a
                href={EXTERNAL_LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                aria-label="Documentation"
              >
                <RiBookLine className="h-6 w-6" />
                <span className="font-zen text-base">Docs</span>
              </a>
              <a
                href={EXTERNAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                aria-label="Discord"
              >
                <RiDiscordFill className="h-6 w-6" />
                <span className="font-zen text-base">Discord</span>
              </a>
              <a
                href={EXTERNAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                aria-label="GitHub"
              >
                <RiGithubFill className="h-6 w-6" />
                <span className="font-zen text-base">GitHub</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
