import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Switch } from '@nextui-org/react';
import { Cross1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { Address, encodeFunctionData } from 'viem';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import morphoBundlerAbi from '@/abis/bundlerV2';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useERC20Approval } from '@/hooks/useERC20Approval';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import { usePermit2 } from '@/hooks/usePermit2';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import useUserPositions from '@/hooks/useUserPositions';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getBundlerV2, MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';
import { Market, MarketPosition } from '@/utils/types';
import { BorrowProcessModal } from './BorrowProcessModal';
import { Button } from './common';
import { MarketInfoBlock } from './common/MarketInfoBlock';

type BorrowModalProps = {
  market: Market;
  onClose: () => void;
};

export function BorrowModal({ market, onClose }: BorrowModalProps): JSX.Element {
  // State for collateral and borrow amounts
  const [collateralAmount, setCollateralAmount] = useState<bigint>(BigInt(0));
  const [borrowAmount, setBorrowAmount] = useState<bigint>(BigInt(0));
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [borrowInputError, setBorrowInputError] = useState<string | null>(null);
  const [useEth, setUseEth] = useState<boolean>(false);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<'approve' | 'signing' | 'borrowing'>('approve');
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { address: account, isConnected, chainId } = useAccount();

  // Get user positions to calculate current LTV
  const { data: userPositions } = useUserPositions(account);

  // Find current position in this market
  const currentPosition = useMemo(() => {
    if (!userPositions || userPositions.length === 0) return null;
    return userPositions.find(
      (position: MarketPosition) => position.market.id === market.uniqueKey,
    );
  }, [userPositions, market]);

  // lltv with 18 decimals
  const lltv = BigInt(market.lltv);

  // Calculate current and new LTV
  const [currentLTV, setCurrentLTV] = useState<bigint>(BigInt(0));
  const [newLTV, setNewLTV] = useState<bigint>(BigInt(0));

  // Find tokens
  const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

  const { switchChain } = useSwitchChain();
  const toast = useStyledToast();

  // Get token balances
  const { data: loanTokenBalance } = useBalance({
    token: market.loanAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const { data: collateralTokenBalance } = useBalance({
    token: market.collateralAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const { data: ethBalance } = useBalance({
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  // Get approval for collateral token
  const {
    authorizePermit2,
    permit2Authorized,
    isLoading: isLoadingPermit2,
    signForBundlers,
  } = usePermit2({
    user: account as `0x${string}`,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    token: market.collateralAsset.address as `0x${string}`,
    refetchInterval: 10000,
    chainId: market.morphoBlue.chain.id,
    tokenSymbol: market.collateralAsset.symbol,
    amount: collateralAmount,
  });

  const { isApproved, approve } = useERC20Approval({
    token: market.collateralAsset.address as Address,
    spender: getBundlerV2(market.morphoBlue.chain.id),
    amount: collateralAmount,
    tokenSymbol: market.collateralAsset.symbol,
  });

  const needSwitchChain = useMemo(
    () => chainId !== market.morphoBlue.chain.id,
    [chainId, market.morphoBlue.chain.id],
  );

  const { price: oraclePrice } = useOraclePrice({
    oracle: market.oracleAddress as Address,
    chainId: market.morphoBlue.chain.id,
  });

  // Calculate current and new LTV whenever relevant values change
  useEffect(() => {
    if (!currentPosition) {
      setCurrentLTV(BigInt(0));
    } else {
      // Calculate current LTV from position data
      const currentCollateralValue =
        (BigInt(currentPosition.collateral) * oraclePrice) / BigInt(10 ** 36);
      const currentBorrowValue = BigInt(currentPosition.borrowAssets || 0);

      if (currentCollateralValue > 0) {
        const ltv = (currentBorrowValue * BigInt(10 ** 18)) / currentCollateralValue;
        setCurrentLTV(ltv);
      } else {
        setCurrentLTV(BigInt(0));
      }
    }
  }, [currentPosition, market, oraclePrice]);

  useEffect(() => {
    // Calculate new LTV based on current position plus new amounts
    const newCollateral = BigInt(currentPosition?.collateral ?? 0) + collateralAmount;
    const newBorrow = BigInt(currentPosition?.borrowAssets ?? 0) + borrowAmount;

    const newCollateralValueInLoan = (newCollateral * oraclePrice) / BigInt(10 ** 36);

    console.log('newCollateralValueInLoan', newCollateralValueInLoan);

    if (newCollateralValueInLoan > 0) {
      const ltv = (newBorrow * BigInt(10 ** 18)) / newCollateralValueInLoan;
      setNewLTV(ltv);
    } else {
      setNewLTV(BigInt(0));
    }
  }, [currentPosition, collateralAmount, borrowAmount, market]);

  const { isConfirming: borrowPending, sendTransactionAsync } = useTransactionWithToast({
    toastId: 'borrow',
    pendingText: `Borrowing ${formatBalance(borrowAmount, market.loanAsset.decimals)} ${
      market.loanAsset.symbol
    }`,
    successText: `${market.loanAsset.symbol} Borrowed`,
    errorText: 'Failed to borrow',
    chainId,
    pendingDescription: `Borrowing from market ${market.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully borrowed from market ${market.uniqueKey.slice(2, 8)}`,
  });

  const executeBorrowTransaction = useCallback(async () => {
    const minSharesToBorrow =
      (borrowAmount * BigInt(market.state.supplyShares)) / BigInt(market.state.supplyAssets) - 1n;

    try {
      const txs: `0x${string}`[] = [];

      if (useEth) {
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'wrapNative',
            args: [collateralAmount],
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
          args: [market.collateralAsset.address as Address, collateralAmount],
        });

        txs.push(tx1);
        txs.push(tx2);
      } else {
        // For standard ERC20 flow, we only need to transfer the tokens
        txs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'erc20TransferFrom',
            args: [market.collateralAsset.address as Address, collateralAmount],
          }),
        );
      }

      setCurrentStep('borrowing');

      // Add the borrow transaction
      const morphoAddCollat = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoSupplyCollateral',
        args: [
          {
            loanToken: market.loanAsset.address as Address,
            collateralToken: market.collateralAsset.address as Address,
            oracle: market.oracleAddress as Address,
            irm: market.irmAddress as Address,
            lltv: BigInt(market.lltv),
          },

          collateralAmount,
          account as Address,
          '0x',
        ],
      });

      const morphoBorrowTx = encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoBorrow',
        args: [
          {
            loanToken: market.loanAsset.address as Address,
            collateralToken: market.collateralAsset.address as Address,
            oracle: market.oracleAddress as Address,
            irm: market.irmAddress as Address,
            lltv: BigInt(market.lltv),
          },
          borrowAmount, // asset to borrow
          0n, // shares to mint (0), we always use `assets` as param
          minSharesToBorrow, // slippageAmount: min borrow shares
          account as Address,
        ],
      });

      txs.push(morphoAddCollat);
      txs.push(morphoBorrowTx);

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
        value: useEth ? collateralAmount : 0n,
      });

      // come back to main borrow page
      setShowProcessModal(false);
    } catch (error: unknown) {
      setShowProcessModal(false);
      toast.error('Borrow Failed', 'Borrow from market failed or cancelled');
    }
  }, [
    account,
    market,
    collateralAmount,
    borrowAmount,
    sendTransactionAsync,
    useEth,
    signForBundlers,
    usePermit2Setting,
    toast,
  ]);

  const approveAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('approve');

      if (useEth) {
        setCurrentStep('borrowing');
        await executeBorrowTransaction();
        return;
      }

      if (usePermit2Setting) {
        // Permit2 flow
        try {
          await authorizePermit2();
          setCurrentStep('signing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 500));

          await executeBorrowTransaction();
        } catch (error: unknown) {
          console.error('Error in Permit2 flow:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Transaction rejected by user');
            } else {
              toast.error('Error', 'Failed to process Permit2 transaction');
            }
          } else {
            toast.error('Error', 'An unexpected error occurred');
          }
          throw error;
        }
        return;
      }

      // Standard ERC20 flow
      if (!isApproved) {
        try {
          await approve();
          setCurrentStep('borrowing');

          // Small delay to prevent UI glitches
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: unknown) {
          console.error('Error in approval:', error);
          if (error instanceof Error) {
            if (error.message.includes('User rejected')) {
              toast.error('Transaction rejected', 'Approval rejected by user');
            } else {
              toast.error('Transaction Error', 'Failed to approve token');
            }
          } else {
            toast.error('Transaction Error', 'An unexpected error occurred during approval');
          }
          throw error;
        }
      } else {
        setCurrentStep('borrowing');
      }

      await executeBorrowTransaction();
    } catch (error: unknown) {
      console.error('Error in approveAndBorrow:', error);
      setShowProcessModal(false);
    }
  }, [
    account,
    authorizePermit2,
    executeBorrowTransaction,
    useEth,
    usePermit2Setting,
    isApproved,
    approve,
    toast,
  ]);

  const signAndBorrow = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    try {
      setShowProcessModal(true);
      setCurrentStep('signing');
      await executeBorrowTransaction();
    } catch (error: unknown) {
      console.error('Error in signAndBorrow:', error);
      setShowProcessModal(false);
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction rejected', 'Transaction rejected by user');
        } else {
          toast.error('Transaction Error', 'Failed to process transaction');
        }
      } else {
        toast.error('Transaction Error', 'An unexpected error occurred');
      }
    }
  }, [account, executeBorrowTransaction, toast]);

  // Calculate LTV color based on proximity to liquidation threshold
  const getLTVColor = (ltv: bigint) => {
    if (ltv === BigInt(0)) return 'text-gray-500';
    const ratio = ltv / lltv;
    if (ratio > 0.9) return 'text-red-500';
    if (ratio > 0.75) return 'text-orange-500';
    return 'text-green-500';
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-lg rounded-lg p-6">
        {showProcessModal && (
          <BorrowProcessModal
            borrow={{
              market,
              collateralAmount,
              borrowAmount,
            }}
            currentStep={currentStep}
            onClose={() => setShowProcessModal(false)}
            tokenSymbol={market.collateralAsset.symbol}
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
              Borrow {loanToken ? loanToken.symbol : market.loanAsset.symbol}
              {loanToken?.img && (
                <Image src={loanToken.img} height={18} width={18} alt={loanToken.symbol} />
              )}
            </div>

            <p className="py-4 opacity-80">
              You are borrowing {market.loanAsset.symbol} from the following market:{' '}
            </p>

            <MarketInfoBlock market={market} />

            <div className="my-2">
              <div className="mt-2 py-2">Market State</div>

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

            {/* Live Price Section */}
            <div className="bg-hovered my-2 rounded-sm p-3">
              <div className="mb-2 font-zen text-sm">Live Price</div>
              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">
                  {market.collateralAsset.symbol}/{market.loanAsset.symbol}:
                </p>
                <p className="text-right font-zen text-sm">
                  {formatBalance(oraclePrice, 36)} {market.loanAsset.symbol}
                </p>
              </div>
            </div>

            {/* LTV Section */}
            <div className="bg-hovered my-2 rounded-sm p-3">
              <div className="mb-2 font-zen text-sm">Loan to Value (LTV)</div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Current LTV:</p>
                <p className={`text-right font-zen text-sm ${getLTVColor(currentLTV)}`}>
                  {formatBalance(currentLTV, 16).toPrecision(4)}%
                </p>
              </div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">New LTV:</p>
                <p className={`text-right font-zen text-sm ${getLTVColor(newLTV)}`}>
                  {formatBalance(newLTV, 16).toPrecision(4)}%
                </p>
              </div>

              <div className="flex items-start justify-between">
                <p className="font-zen text-sm opacity-50">Liquidation LTV:</p>
                <p className="text-right font-zen text-sm text-red-500">
                  {formatBalance(lltv, 16)}%
                </p>
              </div>

              {/* LTV Progress Bar */}
              <div className="mt-3 h-2 w-full rounded-full bg-gray-700">
                <div
                  className={`h-2 rounded-full ${
                    newLTV / lltv > 0.9
                      ? 'bg-red-500'
                      : newLTV / lltv > 0.75
                      ? 'bg-orange-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (Number(newLTV) / Number(lltv)) * 100)}%` }}
                />
              </div>
            </div>

            {isConnected ? (
              <>
                {/* Collateral Input Section */}
                <div className="mb-1 mt-8">
                  <div className="flex items-start justify-between">
                    <p className="font-inter text-sm opacity-50">Collateral Balance:</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-right font-zen">
                        {useEth
                          ? formatBalance(ethBalance?.value ? ethBalance.value : '0', 18)
                          : formatBalance(
                              collateralTokenBalance?.value ? collateralTokenBalance.value : '0',
                              market.collateralAsset.decimals,
                            )}
                      </p>
                      <p className="text-right font-zen">
                        {useEth ? 'ETH' : market.collateralAsset.symbol}{' '}
                      </p>
                      <div>
                        {collateralToken?.img && (
                          <Image
                            src={collateralToken.img}
                            height={16}
                            width={16}
                            alt={collateralToken.symbol}
                          />
                        )}{' '}
                      </div>
                    </div>
                  </div>
                  {collateralToken?.symbol === 'WETH' && (
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

                <div className="block py-2 opacity-80">Collateral amount</div>
                <div className="mb-4 flex items-start justify-between">
                  <div className="relative flex-grow">
                    <Input
                      decimals={market.collateralAsset.decimals}
                      max={
                        useEth
                          ? ethBalance?.value
                            ? ethBalance.value
                            : BigInt(0)
                          : collateralTokenBalance?.value
                          ? collateralTokenBalance.value
                          : BigInt(0)
                      }
                      setValue={setCollateralAmount}
                      setError={setCollateralInputError}
                      exceedMaxErrMessage="Insufficient Balance"
                    />
                    {collateralInputError && (
                      <p className="p-1 text-sm text-red-500">{collateralInputError}</p>
                    )}
                  </div>
                </div>

                {/* Borrow Input Section */}
                <div className="mb-1">
                  <div className="flex items-start justify-between">
                    <p className="font-inter text-sm opacity-50">Loan Balance:</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-right font-zen">
                        {formatBalance(
                          loanTokenBalance?.value ? loanTokenBalance.value : '0',
                          market.loanAsset.decimals,
                        )}
                      </p>
                      <p className="text-right font-zen">{market.loanAsset.symbol}</p>
                      <div>
                        {loanToken?.img && (
                          <Image
                            src={loanToken.img}
                            height={16}
                            width={16}
                            alt={loanToken.symbol}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="block py-2 opacity-80">Borrow amount</div>
                <div className="mb-4 flex items-start justify-between">
                  <div className="relative flex-grow">
                    <Input
                      decimals={market.loanAsset.decimals}
                      max={BigInt(market.state.liquidityAssets)}
                      setValue={setBorrowAmount}
                      setError={setBorrowInputError}
                      exceedMaxErrMessage="Exceeds available liquidity"
                    />
                    {borrowInputError && (
                      <p className="p-1 text-sm text-red-500">{borrowInputError}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <div className="items-center justify-center pt-4">
                  <AccountConnect />
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-4 flex justify-end">
              {needSwitchChain ? (
                <Button
                  onClick={() => void switchChain({ chainId: market.morphoBlue.chain.id })}
                  className="min-w-32"
                  variant="solid"
                >
                  Switch Chain
                </Button>
              ) : (!permit2Authorized && !useEth) || (!usePermit2Setting && !isApproved) ? (
                <Button
                  disabled={
                    !isConnected ||
                    isLoadingPermit2 ||
                    borrowPending ||
                    collateralInputError !== null ||
                    borrowInputError !== null ||
                    collateralAmount === BigInt(0) ||
                    borrowAmount === BigInt(0) ||
                    newLTV >= lltv
                  }
                  onClick={() => void approveAndBorrow()}
                  className="min-w-32"
                  variant="cta"
                >
                  Approve and Borrow
                </Button>
              ) : (
                <Button
                  disabled={
                    !isConnected ||
                    borrowPending ||
                    collateralInputError !== null ||
                    borrowInputError !== null ||
                    collateralAmount === BigInt(0) ||
                    borrowAmount === BigInt(0) ||
                    newLTV >= lltv
                  }
                  onClick={() => void signAndBorrow()}
                  className="min-w-32"
                  variant="cta"
                >
                  {useEth ? 'Borrow' : 'Sign and Borrow'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
