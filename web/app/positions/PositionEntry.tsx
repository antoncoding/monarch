'use client';

import { useState } from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { isAddress } from 'viem';
import { useAccount } from 'wagmi';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';

export default function PositionEntry() {
  const { address } = useAccount();

  const [inputAddress, setInputAddress] = useState<string>('');

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <Toaster />
      <div className="container items-center justify-center gap-8" style={{ padding: '0 5%' }}>
        <div className="flex justify-center py-14">
          <div className="w-full items-center rounded-md p-12 text-center text-lg text-secondary">
            Connect wallet or search an account to view positions.
          </div>
        </div>
        <div className="flex justify-center">
          {/* {show connect button or input} */}
          {address ? (
            <Link href={`/positions/${address}`} className="no-underline">
              <div className="flex font-zen opacity-70 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100">
                <button
                  type="button"
                  className="text-roboto w-80 rounded-sm bg-secondary p-4 px-10 "
                >
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
              <AccountConnect />
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
              className="w-80 bg-secondary p-4 focus:opacity-100"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              placeholder="0x..."
            />

            <button
              // disabled={!isConnected || approvePending}
              type="button"
              onClick={() => {
                if (isAddress(inputAddress.toLowerCase(), { strict: false })) {
                  window.location.href = `/positions/${inputAddress}`;
                } else {
                  console.log('inputAddress', inputAddress);
                  toast.error('Invalid address');
                }
              }}
              className="bg-monarch-orange justify-center p-6 text-center text-sm duration-300 ease-in-out hover:scale-110 hover:opacity-100"
            >
              <ArrowRightIcon />{' '}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
