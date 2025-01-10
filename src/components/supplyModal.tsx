import React, { useCallback, useMemo, useState } from 'react';
import { Switch } from '@nextui-org/react';
import { Cross1Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { Address, encodeFunctionData } from 'viem';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { usePermit2 } from '@/hooks/usePermit2';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { getBundlerV2, getIRMTitle, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { Button } from './common';
import { MarketInfoBlock } from './common/MarketInfoBlock';
import OracleVendorBadge from './OracleVendorBadge';
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
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { address: account, isConnected, chainId } = useAccount();

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

  const { isApproved, approve } = useERC20Approval({
    token: market.loanAsset.address as Address,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    amount: supplyAmount,
    tokenSymbol: market.loanAsset.symbol,
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
      } else if (usePermit2Setting) {
        const { sigs, permitSingle } = await signForBundlers();
        console.log('Signed for bundlers:', { sigs, permitSingle });

        const tx1 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'approve2',
          args: [permitSingle, sigs, false],
        });

        // transferFrom with permit2
        const tx2 = encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'transferFrom2',
          args: [market.loanAsset.address as Address, supplyAmount],
        });

        txs.push(tx1);
        txs.push(tx2);
      } else {
        // For standard ERC20 flow, we only need to transfer the tokens
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [market.loanAsset.address as Address, supplyAmount],
          }),
        );
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
        data: (encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'multicall',
          args: [txs],
        }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
        value: useEth ? supplyAmount : 0n,
      });

      // come back to main supply page
      setShowProcessModal(false);
    } catch (error: unknown) {
      setShowProcessModal(false);
      if (error instanceof Error) {
        toast.error('An error occurred. Please try again.');
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  }, [
    account,
    market,
    supplyAmount,
    sendTransactionAsync,
    useEth,
    signForBundlers,
    usePermit2Setting,
  ]);

  const approveAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('approve');

      if (useEth) {
        setCurrentStep('supplying');
        await executeSupplyTransaction();
        return;
      }

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          await authorizePermit2();
          setCurrentStep('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeSupplyTransaction();
        } catch (error: unknown) {
          console.error('Error in Permit2 flow:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected by user');
            } else {
              toast.error('Failed to process Permit2 transaction');
            }
          } else {
            toast.error('An unexpected error occurred');
          }
          throw error;
        }
        return;
      }

      // Standard ERC20 flow
      if (!isApproved) {
        try {
          await approve();
          setCurrentStep('supplying');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: unknown) {
          console.error('Error in approval:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Approval rejected by user');
            } else {
              toast.error('Failed to approve token');
            }
          } else {
            toast.error('An unexpected error occurred during approval');
          }
          throw error;
        }
      } else {
        setCurrentStep('supplying');
      }

      await executeSupplyTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndSupply:', error);
      setShowProcessModal(false);
    }
  }, [
    account,
    authorizePermit2,
    executeSupplyTransaction,
    useEth,
    usePermit2Setting,
    isApproved,
    approve,
  ]);

  const signAndSupply = useCallback(async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('signing');
      await executeSupplyTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndSupply:', error);
      setShowProcessModal(false);
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected by user');
        } else {
          toast.error('Failed to process transaction');
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  }, [account, executeSupplyTransaction]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-lg rounded-lg p-6">
        {showProcessModal && (
          <SupplyProcessModal
            supplies={[
              {
                market,
                amount: supplyAmount,
              },
            ]}
            currentStep={currentStep}
            onClose={() => setShowProcessModal(false)}
            tokenSymbol={market.loanAsset.symbol}
            useEth={useEth}
            usePermit2={usePermit2Setting}
          />
        )}
        {!showProcessModal && (
          <div className="flex flex-col">
            <button
              type="button"
              className="bg-main absolute right-2 top-2 rounded-full p-1 text-primary hover:cursor-pointer"
              onClick={onClose}
            >
              <Cross1Icon />{' '}
            </button>

            <div className="mb-2 flex items-center gap-2 py-2 text-2xl">
              Supply {loanToken ? loanToken.symbol : market.loanAsset.symbol}
              {loanToken?.img && <Image src={loanToken.img} height={18} alt={loanToken.symbol} />}
            </div>

            <p className="py-4 opacity-80">
              You are supplying {market.loanAsset.symbol} to the following market:{' '}
            </p>

            <MarketInfoBlock market={market} />

            <div className="my-2">
              <div className="mt-4 py-2">Market Config</div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Market ID:</p>
                <a
                  className="group flex items-center gap-1 pr-1 no-underline hover:underline"
                  href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
                  target="_blank"
                >
                  <p className="text-right text-sm">{market.uniqueKey.slice(2, 8)}</p>
                  <ExternalLinkIcon />
                </a>
              </div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Oracle:</p>
                <a
                  className="group flex items-center gap-1 no-underline hover:underline"
                  href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
                  target="_blank"
                >
                  <OracleVendorBadge oracleData={market.oracle.data} showText useTooltip={false} />
                </a>
              </div>
              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">IRM:</p>
                <a
                  className="group flex items-center gap-1 pr-1 no-underline hover:underline"
                  href={getExplorerURL(market.irmAddress, market.morphoBlue.chain.id)}
                  target="_blank"
                >
                  <p className="text-right font-zen text-sm">{getIRMTitle(market.irmAddress)}</p>
                  <ExternalLinkIcon />
                </a>
              </div>
            </div>

            <div className="my-2">
              <div className="mt-4 py-2">Market State</div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Total Supply:</p>

                <p className="text-right text-sm">
                  {formatReadable(
                    formatBalance(market.state.supplyAssets, market.loanAsset.decimals),
                  )}
                </p>
              </div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Liquidity:</p>
                <p className="text-right font-zen text-sm">
                  {formatReadable(
                    formatBalance(market.state.liquidityAssets, market.loanAsset.decimals),
                  )}
                </p>
              </div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Utilization:</p>
                <p className="text-right text-sm">
                  {formatReadable(market.state.utilization * 100)}%
                </p>
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
                    <p className="text-right font-zen">
                      {useEth ? 'ETH' : market.loanAsset.symbol}{' '}
                    </p>
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
                <Button
                  onClick={() => void switchChain({ chainId: market.morphoBlue.chain.id })}
                  className="ml-2 min-w-32"
                  variant="solid"
                >
                  Switch Chain
                </Button>
              ) : (!permit2Authorized && !useEth) || (!usePermit2Setting && !isApproved) ? (
                <Button
                  disabled={!isConnected || isLoadingPermit2 || supplyPending}
                  onClick={() => void approveAndSupply()}
                  className="ml-2 min-w-32"
                  variant="cta"
                >
                  Approve and Supply
                </Button>
              ) : (
                <Button
                  disabled={!isConnected || supplyPending || inputError !== null}
                  onClick={() => void signAndSupply()}
                  className="ml-2 min-w-32"
                  variant="cta"
                >
                  {useEth ? 'Supply' : 'Sign and Supply'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
