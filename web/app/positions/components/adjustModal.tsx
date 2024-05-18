// Import the necessary hooks
import { useCallback, useEffect, useState } from 'react';

import { Cross1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { Address} from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { formatBalance } from '@/utils/balance';
import { MORPHO } from '@/utils/morpho';
import { supportedTokens } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';

type ModalProps = {
  position: MarketPosition;
  onClose: () => void;
};

export function AdjustModal({ position, onClose }: ModalProps): JSX.Element {
  // Add state for the supply amount
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));

  const { address: account, isConnected } = useAccount();

  const loanToken = supportedTokens.find(
    (token) => token.address.toLowerCase() === position.market.loanAsset.address.toLowerCase(),
  );

  const [pendingToastId, setPendingToastId] = useState<string | undefined>();

  const {
    writeContract,
    // data: hash,
    error: supplyError,
    isPending: supplyPending,
    isSuccess: supplySuccess,
  } = useWriteContract();

  const supply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    console.log('withdrawAmount', withdrawAmount)
    console.log('position', position.supplyAssets)

    const isMax =  withdrawAmount.toString() ===  position.supplyAssets;

    console.log('isMax', isMax)

    const assetsToWithdraw = isMax ? '0' : withdrawAmount.toString();
    const sharesToWithdraw = isMax ? position.supplyShares : '0';

    writeContract({
      account,
      address: MORPHO,
      abi: morphoAbi,
      functionName: 'withdraw',
      args: [
        {
          loanToken: position.market.loanAsset.address as Address,
          collateralToken: position.market.collateralAsset.address as Address,
          oracle: position.market.oracleAddress as Address,
          irm: position.market.irmAddress as Address,
          lltv: BigInt(position.market.lltv),
        },
        BigInt(assetsToWithdraw),
        BigInt(sharesToWithdraw),
        account, // onBehalf
        account, // receiver
      ],
    });
  }, [account, position.market, withdrawAmount, writeContract, position.supplyAssets, position.supplyShares]);

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
          Withdraw {loanToken ? loanToken.symbol : position.market.loanAsset.symbol}
          {loanToken?.img && <Image src={loanToken.img} height={18} alt={loanToken.symbol} />}
        </div>

        <p className="py-2 opacity-80">
          {' '}
          You are withdrawing {position.market.loanAsset.symbol} from the following market:{' '}
        </p>

        <div className="mb-2">
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Market ID:</p>
            <p className="font-roboto text-right">{position.market.uniqueKey.slice(2, 8)} ... { position.market.uniqueKey.slice(position.market.uniqueKey.length -6) }</p>
          </div>
          
          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Supplied Amount:</p>

            <div className="flex items-center justify-center gap-2">
                <p className="font-roboto text-right">
                  {formatBalance(
                    position.supplyAssets,
                    position.market.loanAsset.decimals,
                  )}
                </p>
                <p className="font-roboto text-right">{position.market.loanAsset.symbol} </p>
                <div>
                  {loanToken?.img && (
                    <Image src={loanToken.img} height={16} alt={loanToken.symbol} />
                  )}{' '}
                </div>
              </div>
          </div>
        </div>

        {!isConnected &&
          <div className="flex justify-center">
            <div className="items-center justify-center pt-4">
              <AccountConnect />
            </div>
          </div>
        }

        <div className="mt-8 block py-4 opacity-80"> Withdraw amount </div>

        <div className="mb-1 flex items-start justify-between">
          <div className="relative flex-grow">
            <Input 
              decimals={position.market.loanAsset.decimals}
              max={BigInt(position.supplyAssets)}
              setValue={setWithdrawAmount}
              setError={setInputError}
            />
          </div>

          
            <button
              disabled={!isConnected || supplyPending || inputError !== null}
              type="button"
              onClick={() => void supply()}
              className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-white opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100"
            >
              Withdraw
            </button>
        </div>
      </div>
    </div>
  );
}
