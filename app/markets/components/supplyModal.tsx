import React, { useCallback, useMemo, useState } from 'react';
import { Switch } from '@nextui-org/react';
import { Cross1Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import { Address, encodeFunctionData, formatUnits } from 'viem';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useAllowance } from '@/hooks/useAllowance';
import { Market } from '@/hooks/useMarkets';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { getBundlerV2, getIRMTitle } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';

type SupplyModalProps = {
  market: Market;
  onClose: () => void;
};

export function SupplyModal({ market, onClose }: SupplyModalProps): JSX.Element {
  // Add state for the supply amount and using ETH
  const [supplyAmount, setSupplyAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [useEth, setUseEth] = useState<boolean>(false);

  const { address: account, isConnected, chainId } = useAccount();

  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
  const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);

  const { switchChain } = useSwitchChain();

  const { data: tokenBalance } = useBalance({
    token: market.loanAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const { data: ethBalance } = useBalance({
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  // get allowance for morpho
  const { allowance, approveInfinite, approvePending } = useAllowance({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId: market.morphoBlue.chain.id,
  });

  const needApproval = useMemo(() => supplyAmount > allowance, [supplyAmount, allowance]);

  const needSwitchChain = useMemo(
    () => chainId !== market.morphoBlue.chain.id,
    [chainId, market.morphoBlue.chain.id],
  );

  const { isConfirming: supplyPending, sendTransaction } = useTransactionWithToast(
    'supply',
    `Supplying ${formatBalance(supplyAmount, market.loanAsset.decimals)} ${
      market.loanAsset.symbol
    }`,
    `${market.loanAsset.symbol} Supplied`,
    'Failed to supply',
    chainId,
  );

  const supply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    if (chainId !== market.morphoBlue.chain.id) {
      switchChain({ chainId: market.morphoBlue.chain.id });
    }

    const prepareTx = useEth
      ? encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'wrapNative',
          args: [supplyAmount],
        })
      : encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'erc20TransferFrom',
          args: [market.loanAsset.address as Address, supplyAmount],
        });

    const minShares = BigInt(1);

    const morphoSupplyTx = encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoSupply',
      args: [
        {
          loanToken: market.loanAsset.address as Address,
          collateralToken: market.collateralAsset.address as Address,
          oracle: market.oracleAddress as Address,
          irm: market.irmAddress as Address,
          lltv: BigInt(market.lltv),
        },
        supplyAmount,
        BigInt(0),
        minShares,
        account,
        '0x', // callback
      ],
    });

    sendTransaction({
      account,
      to: getBundlerV2(market.morphoBlue.chain.id),
      data: encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'multicall',
        args: [[prepareTx, morphoSupplyTx]],
      }),
      value: useEth ? supplyAmount : 0n,
      chainId: market.morphoBlue.chain.id,
    });
  }, [account, market, supplyAmount, sendTransaction, switchChain, chainId, useEth]);

  return (
    <>
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
            Supply {loanToken ? loanToken.symbol : market.loanAsset.symbol}
            {loanToken?.img && <Image src={loanToken.img} height={18} alt={loanToken.symbol} />}
          </div>

          <p className="py-4 opacity-80">
            {' '}
            You are supplying {market.loanAsset.symbol} to the following market:{' '}
          </p>

          <div className="mb-2">
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">Market ID:</p>
              <p className="text-right font-monospace text-sm">{market.uniqueKey.slice(2, 8)}</p>
            </div>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">Collateral Token:</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-right font-zen">{market.collateralAsset.symbol} </p>
                <div>
                  {collateralToken?.img && (
                    <Image src={collateralToken.img} height={16} alt={collateralToken.symbol} />
                  )}{' '}
                </div>
              </div>
            </div>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">LLTV:</p>
              <p className="text-right font-zen">{formatUnits(BigInt(market.lltv), 16)} %</p>
            </div>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">Oracle:</p>
              <a
                className="group flex items-center gap-1 no-underline hover:underline"
                href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                target="_blank"
              >
                <p className="text-right font-zen text-sm">{market.oracleInfo.type}</p>
                <ExternalLinkIcon />
              </a>
            </div>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-sm opacity-50">IRM:</p>
              <a
                className="group flex items-center gap-1 no-underline hover:underline"
                href={getExplorerURL(market.irmAddress, market.morphoBlue.chain.id)}
                target="_blank"
              >
                <p className="text-right font-zen text-sm">{getIRMTitle(market.irmAddress)}</p>
                <ExternalLinkIcon />
              </a>
            </div>
          </div>

          {isConnected ? (
            <div className="mb-1 mt-8">
              <div className="flex items-start justify-between">
                <p className="font-inter text-sm opacity-50">My Balance:</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-right font-zen">
                    {useEth
                      ? formatBalance(ethBalance?.value ? ethBalance.value : '0', 18)
                      : formatBalance(
                          tokenBalance?.value ? tokenBalance.value : '0',
                          market.loanAsset.decimals,
                        )}
                  </p>
                  <p className="text-right font-zen">{useEth ? 'ETH' : market.loanAsset.symbol} </p>
                  <div>
                    {loanToken?.img && (
                      <Image src={loanToken.img} height={16} alt={loanToken.symbol} />
                    )}{' '}
                  </div>
                </div>
              </div>
              {loanToken?.symbol === 'WETH' && (
                <div className="mx-6 flex items-start justify-between">
                  <div />
                  <div className="mt-4 flex items-center">
                    <div className="mr-2 font-inter text-xs opacity-50">Use ETH instead</div>
                    <Switch
                      size="sm"
                      isSelected={useEth}
                      onValueChange={setUseEth}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              )}
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
              <Input
                decimals={market.loanAsset.decimals}
                max={
                  useEth
                    ? ethBalance?.value
                      ? ethBalance.value
                      : BigInt(0)
                    : tokenBalance?.value
                    ? tokenBalance.value
                    : BigInt(0)
                }
                setValue={setSupplyAmount}
                setError={setInputError}
                exceedMaxErrMessage="Insufficient Balance"
              />
              {inputError && <p className="p-1 text-sm text-red-500">{inputError}</p>}
            </div>

            {needSwitchChain ? (
              <button
                type="button"
                onClick={() => void switchChain({ chainId: market.morphoBlue.chain.id })}
                className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-primary opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
              >
                Switch Chain
              </button>
            ) : needApproval && !useEth ? (
              <button
                disabled={!isConnected || approvePending}
                type="button"
                onClick={() => void approveInfinite()}
                className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-primary opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
              >
                Approve
              </button>
            ) : (
              <button
                disabled={!isConnected || supplyPending || inputError !== null}
                type="button"
                onClick={() => void supply()}
                className="bg-monarch-orange ml-2 h-10 rounded p-2 text-sm text-primary opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
              >
                Supply
              </button>
            )}
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </>
  );
}
