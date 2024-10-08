import React, { useCallback, useMemo, useState } from 'react';
import { Switch } from '@nextui-org/react';
import { Cross1Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData, formatUnits } from 'viem';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { usePermit2 } from '@/hooks/usePermit2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { getBundlerV2, getIRMTitle } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { SupplyProcessModal } from './SupplyProcessModal';

type SupplyModalProps = {
  market: Market;
  onClose: () => void;
};

export function SupplyModal({ market, onClose }: SupplyModalProps): JSX.Element {
  // Add state for the supply amount and using ETH
  const [supplyAmount, setSupplyAmount] = useState<bigint>(BigInt(0));
  const [inputError, setInputError] = useState<string | null>(null);
  const [useEth, setUseEth] = useState<boolean>(false);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<'approve' | 'signing' | 'supplying'>('approve');

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
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.loanAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.loanAsset.symbol,
    amount: supplyAmount,
  });

  const needSwitchChain = useMemo(
    () => chainId !== market.morphoBlue.chain.id,
    [chainId, market.morphoBlue.chain.id],
  );

  const { isConfirming: supplyPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'supply',
    pendingText: `Supplying ${formatBalance(supplyAmount, market.loanAsset.decimals)} ${
      market.loanAsset.symbol
    }`,
    successText: `${market.loanAsset.symbol} Supplied`,
    errorText: 'Failed to supply',
    chainId,
    pendingDescription: `Supplying to market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully supplied to market ${market.uniqueKey.slice(2, 8)}`,
  });

  const executeSupplyTransaction = useCallback(async () => {
    try {
      const txs: `0x${string}`[] = [];
      if (useEth) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [supplyAmount],
          }),
        );
      } else {
        const { sigs, permitSingle } = await signForBundlers();
        console.log('Signed for bundlers:', { sigs, permitSingle });

        const tx1 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });

        const tx2 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [market.loanAsset.address as Address, supplyAmount],
        });

        txs.push(tx1);
        txs.push(tx2);
      }

      setCurrentStep('supplying');

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
          account as `0x${string}`,
          '0x', // callback
        ],
      });

      txs.push(morphoSupplyTx);

      // add timeout here to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await sendTransactionAsync({
        account,
        to: getBundlerV2(market.morphoBlue.chain.id),
        data: encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }),
        value: useEth ? supplyAmount : 0n,
      });

      // come back to main supply page
      setShowProcessModal(false);
    } catch (error) {
      setShowProcessModal(false);
      toast.error('An error occurred. Please try again.');
    }
  }, [account, market, supplyAmount, sendTransactionAsync, useEth, signForBundlers]);

  const approveAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    setShowProcessModal(true);
    setCurrentStep('approve');

    try {
      await authorizePermit2();
      setCurrentStep('signing');

      // add timeout here to prevent rabby reverting
      await new Promise((resolve) => setTimeout(resolve, 800));

      await executeSupplyTransaction();
    } catch (error) {
      console.error('Error during approve and supply:', error);
      setShowProcessModal(false);
      toast.error('An error occurred. Please try again.');
    }
  }, [account, authorizePermit2, executeSupplyTransaction]);

  const signAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    setShowProcessModal(true);
    setCurrentStep('signing');

    try {
      await executeSupplyTransaction();
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    }
  }, [account, executeSupplyTransaction]);

  return showProcessModal ? (
    <SupplyProcessModal
      marketId={market.uniqueKey.slice(2, 8)}
      supplyAmount={formatBalance(supplyAmount, market.loanAsset.decimals)}
      currentStep={currentStep}
      onClose={() => setShowProcessModal(false)}
      tokenSymbol={market.loanAsset.symbol}
      useEth={useEth}
    />
  ) : (
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 font-zen">
      <div
        style={{ width: '600px' }}
        className="relative z-50 rounded bg-secondary p-12 transition-all duration-500 ease-in-out"
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
              className="bg-monarch-orange ml-2 h-10 min-w-32 rounded p-2 text-sm text-white  opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
            >
              Switch Chain
            </button>
          ) : !permit2Authorized && !useEth ? (
            <button
              disabled={!isConnected || isLoadingPermit2}
              type="button"
              onClick={() => void approveAndSupply()}
              className="bg-monarch-orange ml-2 h-10 min-w-32 rounded p-2 text-sm text-white  opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
            >
              Approve and Supply
            </button>
          ) : (
            <button
              disabled={!isConnected || supplyPending || inputError !== null}
              type="button"
              onClick={() => void signAndSupply()}
              className="bg-monarch-orange ml-2 h-10 min-w-32 rounded p-2 text-sm text-white opacity-90 duration-300 ease-in-out hover:scale-110 hover:opacity-100 disabled:opacity-50"
            >
              {useEth ? 'Supply' : 'Sign and Supply'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
