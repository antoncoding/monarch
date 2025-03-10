import React, { useMemo, useState, useEffect } from 'react';
import { Switch } from '@nextui-org/react';
import { Cross1Icon, ReloadIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { Address } from 'viem';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useBorrowTransaction } from '@/hooks/useBorrowTransaction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useOraclePrice } from '@/hooks/useOraclePrice';
import useUserPosition from '@/hooks/useUserPosition';
import { formatBalance, formatReadable } from '@/utils/balance';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { BorrowProcessModal } from './BorrowProcessModal';
import { Button } from './common';

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
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { address: account, isConnected, chainId } = useAccount();

  // Add a loading state for the refresh button
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Get user positions to calculate current LTV
  const { position: currentPosition, refetch: refetchPosition } = useUserPosition(
    account,
    market.morphoBlue.chain.id,
    market.uniqueKey,
  );

  // lltv with 18 decimals
  const lltv = BigInt(market.lltv);

  // Calculate current and new LTV
  const [currentLTV, setCurrentLTV] = useState<bigint>(BigInt(0));
  const [newLTV, setNewLTV] = useState<bigint>(BigInt(0));

  // Find tokens
  const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

  const { switchChain } = useSwitchChain();

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

  // Use the new hook for borrow transaction logic
  const {
    currentStep,
    showProcessModal,
    setShowProcessModal,
    useEth,
    setUseEth,
    isLoadingPermit2,
    isApproved,
    permit2Authorized,
    borrowPending,
    approveAndBorrow,
    signAndBorrow,
  } = useBorrowTransaction({
    market,
    collateralAmount,
    borrowAmount,
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

    if (newCollateralValueInLoan > 0) {
      const ltv = (newBorrow * BigInt(10 ** 18)) / newCollateralValueInLoan;
      setNewLTV(ltv);
    } else {
      setNewLTV(BigInt(0));
    }
  }, [currentPosition, collateralAmount, borrowAmount, market, oraclePrice]);

  const formattedOraclePrice = useMemo(() => {
    const adjusted =
      (oraclePrice * BigInt(10 ** market.collateralAsset.decimals)) /
      BigInt(10 ** market.loanAsset.decimals);
    return formatBalance(adjusted, 36);
  }, [oraclePrice]);

  // Calculate LTV color based on proximity to liquidation threshold
  const getLTVColor = (ltv: bigint) => {
    if (ltv === BigInt(0)) return 'text-gray-500';
    if (ltv >= (lltv * BigInt(80)) / BigInt(100)) return 'text-red-500';
    if (ltv >= (lltv * BigInt(70)) / BigInt(100)) return 'text-orange-500';
    return 'text-green-500';
  };

  // Function to refresh position data
  const handleRefreshPosition = () => {
    setIsRefreshing(true);
    try {
      refetchPosition(() => {
        setIsRefreshing(false);
      });
    } catch (error) {
      console.error('Failed to refresh position:', error);
      setIsRefreshing(false);
    }
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
              {loanToken?.img && (
                <Image src={loanToken.img} height={24} width={24} alt={loanToken.symbol} />
              )}
              {loanToken ? loanToken.symbol : market.loanAsset.symbol} Position
            </div>

            {/* Position Overview Box with dynamic LTV */}
            <div className="bg-hovered mb-5 rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between font-zen text-base">
                <span>Position Overview</span>
                <button
                  type="button"
                  onClick={handleRefreshPosition}
                  className="rounded-full p-1 transition-opacity hover:opacity-70"
                  disabled={isRefreshing}
                  aria-label="Refresh position data"
                >
                  <ReloadIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Current Position Stats */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 font-zen text-xs opacity-50">Total Collateral</p>
                  <div className="flex items-center">
                    {collateralToken?.img && (
                      <Image
                        src={collateralToken.img}
                        height={16}
                        width={16}
                        alt={collateralToken.symbol}
                        className="mr-1"
                      />
                    )}
                    <p className="font-zen text-sm">
                      {formatBalance(
                        BigInt(currentPosition?.collateral ?? 0),
                        market.collateralAsset.decimals,
                      )}{' '}
                      {market.collateralAsset.symbol}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 font-zen text-xs opacity-50">Total Borrowed</p>
                  <div className="flex items-center">
                    {loanToken?.img && (
                      <Image
                        src={loanToken.img}
                        height={16}
                        width={16}
                        alt={loanToken.symbol}
                        className="mr-1"
                      />
                    )}
                    <p className="font-zen text-sm">
                      {formatBalance(
                        BigInt(currentPosition?.borrowAssets ?? 0),
                        market.loanAsset.decimals,
                      )}{' '}
                      {market.loanAsset.symbol}
                    </p>
                  </div>
                </div>
              </div>

              {/* LTV Indicator - Shows both current and projected */}
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
                  <div className="font-zen text-sm">
                    {(borrowAmount > 0 || collateralAmount > 0) && currentLTV > 0 ? (
                      <>
                        <span className="text-gray-400 line-through">
                          {formatBalance(currentLTV, 16).toPrecision(4)}%
                        </span>
                        <span className={`ml-2 ${getLTVColor(newLTV)}`}>
                          {formatBalance(newLTV, 16).toPrecision(4)}%
                        </span>
                      </>
                    ) : (
                      <span className={getLTVColor(currentLTV)}>
                        {formatBalance(currentLTV, 16).toPrecision(4)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-700">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ease-in-out ${
                      (borrowAmount > 0 || collateralAmount > 0 ? newLTV : currentLTV) / lltv > 0.9
                        ? 'bg-red-500'
                        : (borrowAmount > 0 || collateralAmount > 0 ? newLTV : currentLTV) / lltv >
                          0.75
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (Number(borrowAmount > 0 || collateralAmount > 0 ? newLTV : currentLTV) /
                          Number(lltv)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <p className="font-zen text-xs text-red-500">
                    Max LTV: {formatBalance(lltv, 16)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-hovered mb-4 rounded-lg p-4">
              <div className="mb-3 font-zen text-base">Market Stats</div>

              <div className="grid grid-cols-2 gap-y-2">
                <p className="font-zen text-sm opacity-50">APY:</p>
                <p className="text-right font-zen text-sm">
                  {(market.state.borrowApy * 100).toFixed(2)}%
                </p>

                <p className="font-zen text-sm opacity-50">Available Liquidity:</p>
                <p className="text-right font-zen text-sm">
                  {formatReadable(
                    formatBalance(market.state.liquidityAssets, market.loanAsset.decimals),
                  )}
                </p>

                <p className="font-zen text-sm opacity-50">Utilization:</p>
                <p className="text-right font-zen text-sm">
                  {formatReadable(market.state.utilization * 100)}%
                </p>
              </div>
            </div>

            {/* Oracle Price - compact format */}
            <div className="bg-hovered my-3 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="opacity-70">
                  Oracle Price: {market.collateralAsset.symbol}/{market.loanAsset.symbol}
                </span>
                <span className="text-base">
                  {formattedOraclePrice.toFixed(4)} {market.loanAsset.symbol}
                </span>
              </div>
            </div>

            {isConnected ? (
              <>
                {/* Collateral Input Section */}
                <div className="mb-1 mt-8">
                  <div className="flex items-center justify-between">
                    <p className="font-inter text-sm">Add Collateral</p>
                    <p className="font-inter text-xs opacity-50">
                      Balance:{' '}
                      {useEth
                        ? formatBalance(ethBalance?.value ? ethBalance.value : '0', 18)
                        : formatBalance(
                            collateralTokenBalance?.value ? collateralTokenBalance.value : '0',
                            market.collateralAsset.decimals,
                          )}{' '}
                      {useEth ? 'ETH' : market.collateralAsset.symbol}
                    </p>
                  </div>

                  {collateralToken?.symbol === 'WETH' && (
                    <div className="mb-2 mt-1 flex items-center justify-end">
                      <div className="mr-2 font-inter text-xs opacity-50">Use ETH instead</div>
                      <Switch
                        size="sm"
                        isSelected={useEth}
                        onValueChange={setUseEth}
                        classNames={{
                          wrapper: 'w-8 h-4',
                          thumb: 'w-3 h-3',
                        }}
                      />
                    </div>
                  )}

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
                </div>

                {/* Borrow Input Section */}
                <div className="mb-1">
                  <div className="flex items-center justify-between">
                    <p className="font-inter text-sm">Borrow </p>
                    <p className="font-inter text-xs opacity-50">
                      Balance:{' '}
                      {formatBalance(
                        loanTokenBalance?.value ? loanTokenBalance.value : '0',
                        market.loanAsset.decimals,
                      )}{' '}
                      {market.loanAsset.symbol}
                    </p>
                  </div>

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
