// Import the necessary hooks
import { useState } from 'react';

import { useAccount, useConnect } from 'wagmi';
import { Market } from '@/hooks/useMarkets';
import { Cross1Icon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { supportedTokens } from '@/utils/tokens';
import Image from 'next/image';

type SupplyModalProps = {
  market: Market;
  onClose: () => void;
};

export function SupplyModal({ market, onClose }: SupplyModalProps): JSX.Element {
  // Add state for the supply amount
  const [supplyAmount, setSupplyAmount] = useState('');

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const collateralToken = supportedTokens.find(
    (token) => token.address.toLowerCase() === market.collateralAsset.address.toLowerCase(),
  );
  const loanToken = supportedTokens.find(
    (token) => token.address.toLowerCase() === market.loanAsset.address.toLowerCase(),
  );

  return (
    <div className="font-roboto fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
      <div
        style={{ width: '600px' }}
        className="bg-monarch-soft-black relative z-50 rounded-sm p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="bg-monarch-black absolute right-2 top-2 rounded-full p-1 text-white hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />{' '}
        </button>

        <div className="mb-4 flex items-center gap-2 p-2 text-2xl">
          Supply {loanToken ? loanToken.symbol : market.loanAsset.symbol}
          {loanToken?.img && <Image src={loanToken.img} height={15} alt={loanToken.symbol} />}
        </div>

        <p className="py-2 opacity-80">
          {' '}
          You are adding {market.loanAsset.symbol} to the following market:{' '}
        </p>

        <div className="mb-2">
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Market ID:</p>
            <p className="font-roboto text-right">{market.id}</p>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Collateral Token:</p>
            <div className="flex items-center gap-2 ">
              <p className="font-roboto text-right">{market.collateralAsset.symbol} </p>
              <div>
                {collateralToken?.img && (
                  <Image src={collateralToken.img} height={15} alt={collateralToken.symbol} />
                )}{' '}
              </div>
            </div>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">LLTV:</p>
            <p className="font-roboto text-right">{formatUnits(BigInt(market.lltv), 16)} %</p>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Oracle:</p>
            <p className="font-roboto text-right">{market.oracleInfo.type}</p>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">IRM:</p>
            <p className="font-roboto text-right">{market.irmAddress}</p>
          </div>
        </div>

        <label className="mt-8 block">
          Supply amount:
          <input
            type="number"
            value={supplyAmount}
            onChange={(e) => setSupplyAmount(e.target.value)}
            className="mt-2 w-full rounded border p-2"
          />
        </label>

        <button
          type="button"
          onClick={() => ''}
          className="bg-monarch-orange mt-4 w-full rounded p-2 text-white"
        >
          Supply
        </button>
      </div>
    </div>
  );
}
