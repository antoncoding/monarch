'use client';

import Link from 'next/link';
import {
  RiBookLine,
  RiDiscordFill,
  RiGithubFill,
  RiArrowDownLine,
  RiArrowRightLine,
  RiSearchLine,
  RiLineChartLine,
  RiShieldCheckLine,
  RiHandCoinLine,
  RiUserSettingsLine,
  RiSettings4Line,
  RiExchangeLine,
  RiRocketLine,
  RiUmbrellaLine,
} from 'react-icons/ri';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { EXTERNAL_LINKS } from '@/utils/external';

import { SectionTag, GridAccent, FeatureCard, ResponsiveGridDivider, ScrollGridReveal, HalftoneImage } from '@/components/landing';

import { CustomTypingAnimation } from './typing-title';
function HomePage() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-main min-h-screen font-zen relative">
      {/* Full page dot grid background with fade */}
      <div
        className="fixed inset-0 bg-dot-grid pointer-events-none opacity-60"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
        }}
        aria-hidden="true"
      />

      <Header ghost />

      <main className="relative z-10 mx-auto w-full pt-[48px] md:pt-[56px]">
        {/* Hero Section - Clean Greptile-style layout */}
        <section className="relative min-h-[calc(100vh-48px)] md:min-h-[calc(100vh-56px)] flex flex-col">
          {/* Subtle dot grid with radial focus gradient */}
          <div
            className="absolute inset-0 z-0 bg-dot-grid pointer-events-none"
            style={{
              opacity: 1,
              maskImage: 'radial-gradient(ellipse 90% 80% at 30% 50%, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 30% 50%, black 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <GridAccent
            position="top-right"
            variant="dots"
            size="lg"
          />

          {/* Main hero content */}
          <div className="flex-1 flex items-center">
            <div className="container mx-auto px-6 sm:px-8 md:px-12 lg:px-16">
              {/* Two-column grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                {/* Left column - content */}
                <div className="max-w-xl">
                  {/* Section tag */}
                  <div className="flex items-center gap-4 mb-6">
                    <SectionTag>DeFi Lending for Powerusers</SectionTag>
                  </div>

                  {/* Main headline */}
                  <h2 className="font-zen text-3xl text-primary sm:text-4xl md:text-5xl mb-3">Lending, Unfiltered</h2>

                  {/* Typing animation subtitle */}
                  <div className="mb-10 h-16 sm:h-20">
                    <CustomTypingAnimation />
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      variant="default"
                      size="lg"
                      className="w-full sm:w-auto min-w-[180px] font-zen"
                      onClick={() => scrollToSection('section-1')}
                    >
                      Learn More
                    </Button>
                    <Link
                      href="/markets"
                      className="block no-underline"
                    >
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full sm:w-auto min-w-[180px] font-zen"
                      >
                        Explore Markets
                        <RiArrowRightLine className="h-5 w-5 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right column - halftone image (hidden on mobile/tablet) */}
                <div className="hidden lg:flex justify-end">
                  <HalftoneImage
                    image="/imgs/home/landing.png"
                    width={560}
                    height={340}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Subtle 1-row grid to define content area - full container width */}
              <div className="mt-12">
                <ResponsiveGridDivider
                  rows={1}
                  noGradient
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Core Features */}
        <section
          id="section-1"
          className="relative flex w-full items-center py-16 md:min-h-screen md:py-24"
        >
          {/* Section background with subtle grid */}
          <div
            className="absolute inset-0 bg-surface"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-line-grid opacity-40 pointer-events-none"
            aria-hidden="true"
          />

          <div className="container relative mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto max-w-7xl">
              {/* Section header */}
              <div className="mb-8 sm:mb-12">
                <div className="flex items-center gap-4 mb-4">
                  <ScrollGridReveal
                    direction="ltr"
                    cellCount={10}
                  />
                  <SectionTag>Market Analysis</SectionTag>
                </div>
                <h2 className="font-zen text-3xl text-primary sm:text-4xl md:text-5xl mb-3">Fully Customizable</h2>
                <p className="text-lg text-secondary sm:text-xl md:text-2xl max-w-2xl">Permission-less Access to Every Morpho Market</p>
              </div>

              {/* Feature cards grid */}
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                <FeatureCard
                  icon={<RiSearchLine className="h-6 w-6" />}
                  title="Advanced Filtering"
                  description="Search by asset, oracle, network. Filter by volume, assets, and risk metrics."
                  href="/markets"
                />
                <FeatureCard
                  icon={<RiLineChartLine className="h-6 w-6" />}
                  title="Full Transparency"
                  description="Compare APY, utilization, oracle feeds, and risk breakdowns across all markets."
                  href="/markets"
                />
                <FeatureCard
                  icon={<RiShieldCheckLine className="h-6 w-6" />}
                  title="Risk Visibility"
                  description="Asset risk, oracle risk, and debt indicators. Make informed decisions."
                  href="/markets"
                />
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:mt-12 sm:flex-row sm:gap-4">
                <Button
                  variant="default"
                  size="lg"
                  className="font-zen flex w-auto min-w-[200px] items-center justify-center gap-2"
                  onClick={() => scrollToSection('section-2')}
                >
                  Continue
                  <RiArrowDownLine className="h-5 w-5" />
                </Button>
                <Link
                  href="/markets"
                  className="inline-block no-underline"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="font-zen flex w-auto min-w-[200px] items-center justify-center gap-2"
                  >
                    Explore Markets
                    <RiArrowRightLine className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Full Control */}
        <section
          id="section-2"
          className="relative flex w-full items-center py-16 md:min-h-screen md:py-24"
        >
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none"
            aria-hidden="true"
          />

          <div className="container relative mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto max-w-7xl">
              {/* Section header */}
              <div className="mb-8 sm:mb-12 text-center">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <ScrollGridReveal
                    direction="center-out"
                    cellCount={12}
                  />
                  <SectionTag>Portfolio</SectionTag>
                  <ScrollGridReveal
                    direction="center-out"
                    cellCount={12}
                  />
                </div>
                <h2 className="font-zen text-3xl text-primary sm:text-4xl md:text-5xl mb-4">Your Risk, Your Rules</h2>
                <p className="text-lg text-secondary sm:text-xl italic max-w-2xl mx-auto">
                  "When you don't understand the yield, you are the yield."
                </p>
              </div>

              {/* Feature cards */}
              <div className="grid gap-4 sm:gap-6 md:grid-cols-3 max-w-4xl mx-auto">
                <FeatureCard
                  icon={<RiExchangeLine className="h-6 w-6" />}
                  title="Smart Rebalancing"
                  description="Move positions between markets with the same loan asset. Batch multiple actions in one transaction."
                  href="/positions"
                  className="bg-main"
                />
                <FeatureCard
                  icon={<RiHandCoinLine className="h-6 w-6" />}
                  title="Zero Platform Fees"
                  description="Direct protocol interaction. No middlemen, no hidden costs."
                  className="bg-main"
                />
                <FeatureCard
                  icon={<RiUserSettingsLine className="h-6 w-6" />}
                  title="Full Risk Control"
                  description="Monitor risk indicators, collateral exposure, and accrued interest across all positions."
                  href="/positions"
                  className="bg-main"
                />
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-12 sm:flex-row sm:gap-4">
                <Link
                  href="/positions"
                  className="inline-block no-underline"
                >
                  <Button
                    variant="default"
                    size="lg"
                    className="font-zen flex w-auto min-w-[200px] items-center justify-center gap-2"
                  >
                    Manage Positions
                    <RiArrowRightLine className="h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  size="lg"
                  className="font-zen flex w-auto min-w-[200px] items-center justify-center gap-2"
                  onClick={() => scrollToSection('section-3')}
                >
                  Automation
                  <RiArrowDownLine className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Grid Divider */}
        <ResponsiveGridDivider rows={8} />

        {/* Section 3: Automation & Monitoring */}
        <section
          id="section-3"
          className="relative flex w-full items-center py-16 md:min-h-screen md:py-24"
        >
          {/* Section background */}
          <div
            className="absolute inset-0 bg-surface"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-line-grid opacity-40 pointer-events-none"
            aria-hidden="true"
          />

          <div className="container relative mx-auto px-6 sm:px-8 md:px-12">
            <div className="mx-auto max-w-7xl">
              {/* Section header */}
              <div className="mb-8 text-center sm:mb-12">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <ScrollGridReveal
                    direction="rtl"
                    cellCount={10}
                  />
                  <SectionTag>AutoVault</SectionTag>
                </div>
                <h2 className="mb-3 font-zen text-3xl text-primary sm:text-4xl md:text-5xl">Set It, Secure It</h2>
                <p className="text-lg text-secondary sm:text-xl md:text-2xl">Automated Yield Optimization Within Your Boundaries</p>
              </div>

              {/* Feature cards */}
              <div className="grid gap-4 sm:gap-6 md:grid-cols-3 max-w-4xl mx-auto">
                <FeatureCard
                  icon={<RiRocketLine className="h-6 w-6" />}
                  title="Deploy"
                  description="Launch your own vault in one click. Full ownership, no middlemen."
                  href="/autovault"
                />
                <FeatureCard
                  icon={<RiSettings4Line className="h-6 w-6" />}
                  title="Configure"
                  description="Set allocation caps, choose agents, define collateral limits. Your rules."
                />
                <FeatureCard
                  icon={<RiUmbrellaLine className="h-6 w-6" />}
                  title="Enjoy"
                  description="Sit back while agents optimize yield. Zero hassle, hundred percent control."
                />
              </div>

              {/* CTA Button */}
              <div className="mt-8 mx-auto flex justify-center sm:mt-12">
                <Link
                  href="/autovault"
                  className="block no-underline"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-auto min-w-[200px] font-zen"
                  >
                    Try AutoVault
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer - Compact Community Section */}
        <section className="relative w-full py-12 md:py-16">
          {/* Subtle background */}
          <div
            className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none"
            aria-hidden="true"
          />

          <div className="container relative mx-auto px-6 sm:px-8 md:px-12">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="mb-3 font-zen text-xl text-primary sm:text-2xl">Join the Community</h2>
              <p className="mb-6 text-sm text-secondary sm:text-base">Stay updated on the latest features in decentralized lending.</p>

              {/* Social Links - Horizontal */}
              <div className="flex items-center justify-center gap-6">
                <a
                  href={EXTERNAL_LINKS.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                  aria-label="Documentation"
                >
                  <RiBookLine className="h-5 w-5" />
                  <span className="font-zen text-sm">Docs</span>
                </a>
                <a
                  href={EXTERNAL_LINKS.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                  aria-label="Discord"
                >
                  <RiDiscordFill className="h-5 w-5" />
                  <span className="font-zen text-sm">Discord</span>
                </a>
                <a
                  href={EXTERNAL_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-secondary no-underline transition-colors hover:text-primary"
                  aria-label="GitHub"
                >
                  <RiGithubFill className="h-5 w-5" />
                  <span className="font-zen text-sm">GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
