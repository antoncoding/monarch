'use client';

import { GitHubLogoIcon } from '@radix-ui/react-icons';
import NextLink from 'next/link';
import { NavbarLink } from '@/components/layout/header/Navbar';

export default function Footer() {
  return (
    <footer className="flex flex-1 flex-col justify-end font-zen text-sm">
      <div className="bg-surface flex flex-col justify-between gap-16 py-4">
        <div className="text-footer-light-gray container mx-auto flex flex-col justify-between px-8 md:flex-row">
          <div className="flex w-full flex-col justify-between gap-2 md:flex-row">
            {/* logo and github */}
            <div className="flex h-8 w-full items-center justify-center gap-2 md:w-1/3">
              <NextLink
                href="https://github.com/antoncoding/monarch"
                className=" no-underline"
                target="_blank"
              >
                Github
              </NextLink>
              <NavbarLink href="https://github.com/antoncoding/monarch" target="_blank">
                <GitHubLogoIcon width="24" height="24" aria-label="Monarch" />
              </NavbarLink>
            </div>

            {/* build with love  */}
            <div className="flex h-8 w-full items-center justify-center md:w-1/3">
              <p className="text-sm leading-7 ">Build with 💙 on Morpho Blue</p>
            </div>

            {/* license link */}
            <div className="flex h-8 w-full items-center justify-center md:w-1/3">
              <NextLink
                href="https://t.me/+kM48_lzD9gQ3NzRl"
                target="_blank"
                className="no-underline"
              >
                Send Feedback
              </NextLink>{' '}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
