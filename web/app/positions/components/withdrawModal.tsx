// Import the necessary hooks
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Cross1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { Address } from 'viem';
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { formatBalance, formatReadable, min } from '@/utils/balance';
import { MORPHO } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';

type ModalProps = {
  position: MarketPosition;
  onClose: () => void;
};

export function WithdrawModal({ position, onClose }: ModalProps): JSX.Element {
  // Add state for the supply amount
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));

  const { address: account, isConnected, chainId } = useAccount();

  const loanToken = findToken(
    position.market.loanAsset.address,
    position.market.morphoBlue.chain.id,
  );

  const [pendingToastId, setPendingToastId] = useState<string | undefined>();

  const needSwitchChain = useMemo(
    () => chainId !== position.market.morphoBlue.chain.id,
    [chainId, position.market.morphoBlue.chain.id],
  );

  const { switchChain } = useSwitchChain();

  const {
    data: hash,
    writeContract,
    // data: hash,
    error: supplyError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    const isMax = withdrawAmount.toString() === position.supplyAssets;

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
      chainId: position.market.morphoBlue.chain.id,
    });
  }, [
    account,
    position.market,
    withdrawAmount,
    writeContract,
    position.supplyAssets,
    position.supplyShares,
  ]);

  useEffect(() => {
    if (isConfirming) {
      const pendingId = toast.loading('Tx Pending');
      setPendingToastId(pendingId);
    }
  }, [isConfirming]);

  useEffect(() => {
    if (isConfirmed) {
      toast.success('Asset Withdrawn!');
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
  }, [isConfirmed, supplyError, pendingToastId]);

  return (
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 font-zen">
      <div
        style={{ width: '600px' }}
        className="relative z-50 rounded-sm bg-secondary p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary hover:cursor-pointer"
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
            <p className="text-right font-monospace text-sm">
              {position.market.uniqueKey.slice(2, 8)}
            </p>
          </div>
          <div className="my-2 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Available Liquidity:</p>

            <div className="flex items-center justify-center gap-2">
              <p className="text-right font-zen">
                {formatReadable(
                  formatBalance(
                    position.market.state.liquidityAssets,
                    position.market.loanAsset.decimals,
                  ),
                )}
              </p>
              <p className="text-right font-zen">{position.market.loanAsset.symbol} </p>
              <div>
                {loanToken?.img && <Image src={loanToken.img} height={16} alt={loanToken.symbol} />}{' '}
              </div>
            </div>
          </div>

          <div className="mb-1 flex items-start justify-between">
            <p className="font-inter text-sm opacity-50">Supplied Amount:</p>

            <div className="flex items-center justify-center gap-2">
              <p className="text-right font-zen">
                {formatReadable(
                  formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
                )}
              </p>
              <p className="text-right font-zen">{position.market.loanAsset.symbol} </p>
              <div>
                {loanToken?.img && <Image src={loanToken.img} height={16} alt={loanToken.symbol} />}{' '}
              </div>
            </div>
          </div>
        </div>

        {!isConnected && (
          <div className="flex justify-center">
            <div className="items-center justify-center pt-4">
              <AccountConnect />
            </div>
          </div>
        )}

        <div className="mt-8 block py-4 opacity-80"> Withdraw amount </div>

        <div className="mb-1 flex items-start justify-between">
          <div className="relative flex-grow">
            <Input
              decimals={position.market.loanAsset.decimals}
              max={min(
                BigInt(position.supplyAssets),
                BigInt(position.market.state.liquidityAssets),
              )}
              setValue={setWithdrawAmount}
              setError={setInputError}
              exceedMaxErrMessage="Insufficient Liquidity"
            />
            {/* input error */}
            {inputError && <p className="p-1 text-sm text-red-500">{inputError}</p>}
          </div>
          {needSwitchChain ? (
            <button
              type="button"
              onClick={() => switchChain({ chainId: position.market.morphoBlue.chain.id })}
              className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-primary opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100"
            >
              Switch Chain
            </button>
          ) : (
            <button
              disabled={!isConnected || isConfirming || inputError !== null}
              type="button"
              onClick={() => void withdraw()}
              className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-primary opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
