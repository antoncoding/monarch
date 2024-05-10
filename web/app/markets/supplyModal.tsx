// Import the necessary hooks
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Cross1Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-hot-toast'
import { Address, formatUnits } from 'viem';
import { useAccount, useBalance, useWriteContract } from 'wagmi';
import morphoAbi from '@/abis/morpho'
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useAllowance } from '@/hooks/useAllowance';
import { Market } from '@/hooks/useMarkets';
import { formatBalance, toRawBalance } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { MORPHO } from '@/utils/morpho';
import { supportedTokens } from '@/utils/tokens';

type SupplyModalProps = {
  market: Market;
  onClose: () => void;
};

export function SupplyModal({ market, onClose }: SupplyModalProps): JSX.Element {
  // Add state for the supply amount
  const [inputSupplyAmount, setInputSupplyAmount] = useState('0');

  const { address: account, isConnected } = useAccount();

  const collateralToken = supportedTokens.find(
    (token) => token.address.toLowerCase() === market.collateralAsset.address.toLowerCase(),
  );
  const loanToken = supportedTokens.find(
    (token) => token.address.toLowerCase() === market.loanAsset.address.toLowerCase(),
  );

  const { data: tokenBalance } = useBalance({
    token: market.loanAsset.address as `0x${string}`,
    address: account,
  });

  // get allowance for morpho
  const { allowance, approveInfinite, approvePending } = useAllowance({
    user: account as `0x${string}`,
    spender: MORPHO,
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10000,
  });

  const supplyAmount = useMemo(
    () => toRawBalance(inputSupplyAmount, market.loanAsset.decimals),
    [inputSupplyAmount, market.loanAsset.decimals],
  );

  const [pendingToastId, setPendingToastId] = useState<string | undefined>();

  const needApproval = useMemo(() => supplyAmount > allowance, [supplyAmount, allowance]);

  const {
    writeContract,
    data: hash,
    error: supplyError,
    isPending: supplyPending,
    isSuccess: supplySuccess,
  } = useWriteContract();

  const supply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return
    };

    writeContract({
      account,
      address: MORPHO,
      abi: morphoAbi,
      functionName: 'supply',
      args: [{
          loanToken: market.loanAsset.address as Address,
          collateralToken: market.collateralAsset.address as Address,
          oracle: market.oracleAddress as Address,
          irm: market.irmAddress as Address,
          lltv: BigInt(market.lltv)
      }, 
      BigInt(supplyAmount.toString()), // todo: more precise way?
      BigInt(0),
      account,
      "0x"
    ],
    });
  }, [account, market, supplyAmount, writeContract]);

  
  useEffect(() => {
    if (supplyPending) {
      const pendingId = toast.loading('Tx Pending');
      setPendingToastId(pendingId);
    }
  }, [supplyPending]);

  useEffect(() => {
    if (supplySuccess) {
      toast.success('Asset Supplied');
      if (pendingToastId) {
        toast.dismiss(pendingToastId);
      }
    }
    if (supplyError) {
      toast.error('Tx Error');
      if (pendingToastId) {
        toast.dismiss(pendingToastId);
      }
    }
  }, [supplySuccess, supplyError, pendingToastId]);

  console.log('supply tx', hash)

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
          {loanToken?.img && <Image src={loanToken.img} height={18} alt={loanToken.symbol} />}
        </div>

        <p className="py-2 opacity-80">
          {' '}
          You are supplying {market.loanAsset.symbol} to the following market:{' '}
        </p>

        <div className="mb-2">
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Market ID:</p>
            <p className="font-roboto text-right">{market.id}</p>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Collateral Token:</p>
            <div className="flex items-center justify-center gap-2">
              <p className="font-roboto text-right">{market.collateralAsset.symbol} </p>
              <div>
                {collateralToken?.img && (
                  <Image src={collateralToken.img} height={16} alt={collateralToken.symbol} />
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
            <a
              className="group flex items-center gap-1 no-underline hover:underline"
              href={getExplorerURL(market.oracleAddress)}
              target="_blank"
            >
              <p className="font-roboto text-right text-sm">{market.oracleInfo.type}</p>
              <ExternalLinkIcon />
            </a>
          </div>
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">IRM:</p>
            <a
              className="group flex items-center gap-1 no-underline hover:underline"
              href={getExplorerURL(market.irmAddress)}
              target="_blank"
            >
              <p className="font-roboto text-right text-sm">{market.irmAddress}</p>
              <ExternalLinkIcon />
            </a>
          </div>
        </div>

        {isConnected ? (
          <div className="mt-8">
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">My Balance:</p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-roboto text-right">
                  {' '}
                  {formatBalance(
                    tokenBalance?.value ? tokenBalance.value : '0',
                    market.loanAsset.decimals,
                  )}{' '}
                </p>
                <p className="font-roboto text-right">{market.loanAsset.symbol} </p>
                <div>
                  {loanToken?.img && (
                    <Image src={loanToken.img} height={16} alt={loanToken.symbol} />
                  )}{' '}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="items-center justify-center pt-4">
              <AccountConnect />
            </div>
          </div>
        )}

        <div className="mt-8 block py-4 opacity-80"> Supply amount </div>

        <div className="mb-1 flex items-start justify-between">
          <div className="relative flex-grow">
            <input
              type="number"
              value={inputSupplyAmount}
              onChange={(e) => {
                setInputSupplyAmount(e.target.value);
              }}
              className="focus:border-monarch-orange h-10 w-full rounded p-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setInputSupplyAmount(
                  formatBalance(tokenBalance?.value ?? '0', loanToken?.decimals ?? 18).toString(),
                )
              }
              className="bg-monarch-soft-black absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 text-white duration-300 ease-in-out hover:scale-105 hover:opacity-100"
            >
              Max
            </button>
          </div>

          {needApproval ? (
            <button
              disabled={!isConnected || approvePending}
              type="button"
              onClick={() => void approveInfinite()}
              className="bg-monarch-orange ml-4 h-10 rounded p-2 text-white opacity-90 duration-300 ease-in-out hover:scale-105 hover:opacity-100"
            >
              Approve
            </button>
          ) : (
            <button
              disabled={!isConnected || supplyPending}
              type="button"
              onClick={() => void supply()}
              className="bg-monarch-orange ml-4 h-10 rounded p-2 text-white opacity-90 duration-300 ease-in-out hover:scale-105 hover:opacity-100"
            >
              Supply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
