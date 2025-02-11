'use client';

import { useState } from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { isAddress } from 'viem';
import { useAccount } from 'wagmi';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';
import { useStyledToast } from '@/hooks/useStyledToast';

export default function SearchOrConnect({ path }: { path: string }) {
  const { address } = useAccount();
  const toast = useStyledToast();
  const [inputAddress, setInputAddress] = useState<string>('');

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container items-center justify-center gap-8 px-[5%]">
        <div className="flex justify-center py-14">
          <div className="w-full items-center rounded-md p-12 text-center text-lg text-secondary">
            Connect wallet or search an account to continue.
          </div>
        </div>
        <div className="flex justify-center">
          {/* {show connect button or input} */}
          {address ? (
            <Link href={`/${path}/${address}`} className="no-underline">
              <div className="flex font-zen opacity-70 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100">
                <button type="button" className="text-roboto bg-surface w-80 rounded-sm p-4 px-10 ">
                  View Account {address.slice(0, 8)}
                </button>
                <div className="bg-monarch-orange w-15 justify-center p-6 text-center text-3xl">
                  {' '}
                  <ArrowRightIcon />{' '}
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ maxWidth: 250 }} className="flex justify-center">
              <AccountConnect onConnectPath={path} />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-8 p-8 pb-6 opacity-50">
          <div className="w-1/6 border-t text-secondary" /> or
          <div className="w-1/6 border-t text-secondary" />
        </div>

        {/* Search Bar */}
        <div className="flex justify-center">
          <div className="flex font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100">
            <input
              className="bg-surface w-80 p-4 focus:opacity-100"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              placeholder="0x..."
            />

            <button
              type="button"
              onClick={() => {
                if (isAddress(inputAddress.toLowerCase(), { strict: false })) {
                  window.location.href = `/${path}/${inputAddress}`;
                } else {
                  toast.error('Invalid address', `The address ${inputAddress} is not valid.`);
                }
              }}
              className="bg-monarch-orange justify-center p-6 text-center text-sm duration-100 ease-in-out hover:opacity-100"
            >
              <ArrowRightIcon />{' '}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
