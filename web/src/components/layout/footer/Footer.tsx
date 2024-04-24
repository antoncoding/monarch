'use client';

import { GitHubLogoIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import NextLink from 'next/link';
import { NavbarLink } from '@/components/layout/header/Navbar';

import logo from '../../imgs/logo.png';

export default function Footer() {
  return (
    <footer className="flex flex-1 flex-col justify-end">
      <div className="flex flex-col justify-between gap-16 bg-boat-footer-dark-gray py-8">
        <div className="container mx-auto flex flex-col md:flex-row justify-between px-8">
          <div className="flex flex-col md:flex-row justify-between w-full">
            {/* logo and github */}
            <div className="flex h-8 w-full md:w-1/3 items-center justify-center gap-4">
              <NextLink href="/" passHref className="relative h-8 w-8" aria-label="Home page">
                <Image src={logo} alt="logo" />
              </NextLink>
              <NextLink
                href="/"
                passHref
                className="text-center font-medium text-boat-footer-light-gray no-underline"
              >
                Github
              </NextLink>
              <NavbarLink href="https://github.com/antoncoding/monarch" target="_blank">
                <GitHubLogoIcon width="24" height="24" aria-label="Monarch" />
              </NavbarLink>
            </div>

            {/* build with love  */}
            <div className="flex h-8 w-full md:w-1/3 items-center justify-center">
              <p className="text-base font-normal leading-7 text-boat-footer-light-gray">
                Build with 💙 on Morpho.
              </p>
            </div>
            
            {/* license link */}
            <div className="flex h-8 w-full md:w-1/3 items-center justify-center">
              <p className='text-base text-boat-footer-light-gray'>
                <NextLink
                  href="https://github.com/antoncoding/monarch/blob/main/LICENSE.md"
                  target="_blank"
                  className='no-underline'
                >
                  View LICENSE
                </NextLink>{' '}
              </p>
            </div>
          </div>

          {/* <div className="font-roboto flex flex-col items-start justify-center gap-4 text-center text-xl font-medium text-white">
            EXPERIENCES
            <NavbarLink href="/buy-me-coffee">
              <span className="flex items-center gap-1 px-2">
                Buy Me Coffee <ArrowTopRightIcon width="16" height="16" />
              </span>
            </NavbarLink>
            <NavbarLink href="/mint">
              <span className="flex items-center gap-1 px-2">
                Mint NFT <ArrowTopRightIcon width="16" height="16" />
              </span>
            </NavbarLink>
            <NavbarLink href="/paymaster-bundler">
              <span className="flex items-center gap-1 px-2">
                Paymaster Bundler <ArrowTopRightIcon width="16" height="16" />
              </span>
            </NavbarLink>
          </div> */}
        </div>
      </div>
    </footer>
  );
}
