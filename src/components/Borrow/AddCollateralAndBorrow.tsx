import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import { LTVWarning } from '@/components/common/LTVWarning';
import { MarketDetailsBlock } from '@/components/common/MarketDetailsBlock';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useBorrowTransaction } from '@/hooks/useBorrowTransaction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getNativeTokenSymbol } from '@/utils/networks';
import { isWrappedNativeToken } from '@/utils/tokens';
import type { Market, MarketPosition } from '@/utils/types';
import { BorrowProcessModal } from '../BorrowProcessModal';
import { TokenIcon } from '../TokenIcon';
import { getLTVColor, getLTVProgressColor } from './helpers';

type BorrowLogicProps = {
  market: Market;
  currentPosition: MarketPosition | null;
  collateralTokenBalance: bigint | undefined;
  ethBalance: bigint | undefined;
  oraclePrice: bigint;
  onSuccess?: () => void;
  isRefreshing?: boolean;
};

export function AddCollateralAndBorrow({
  market,
  currentPosition,
  collateralTokenBalance,
  ethBalance,
  oraclePrice,
  onSuccess,
  isRefreshing = false,
}: BorrowLogicProps): JSX.Element {
  // State for collateral and borrow amounts
  const [collateralAmount, setCollateralAmount] = useState<bigint>(BigInt(0));
  const [borrowAmount, setBorrowAmount] = useState<bigint>(BigInt(0));
  const [collateralInputError, setCollateralInputError] = useState<string | null>(null);
  const [borrowInputError, setBorrowInputError] = useState<string | null>(null);
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const { isConnected } = useAccount();

  // lltv with 18 decimals
  const lltv = BigInt(market.lltv);

  // Calculate current and new LTV
  const [currentLTV, setCurrentLTV] = useState<bigint>(BigInt(0));
  const [newLTV, setNewLTV] = useState<bigint>(BigInt(0));

  // Use the market network hook for chain switching
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: market.morphoBlue.chain.id,
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
    onSuccess,
  });

  // Calculate current and new LTV whenever relevant values change
  useEffect(() => {
    if (!currentPosition) {
      setCurrentLTV(BigInt(0));
    } else {
      // Calculate current LTV from position data using oracle price
      const currentCollateralValue = (BigInt(currentPosition.state.collateral) * oraclePrice) / BigInt(10 ** 36);
      const currentBorrowValue = BigInt(currentPosition.state.borrowAssets || 0);

      if (currentCollateralValue > 0) {
        const ltv = (currentBorrowValue * BigInt(10 ** 18)) / currentCollateralValue;
        setCurrentLTV(ltv);
      } else {
        setCurrentLTV(BigInt(0));
      }
    }
  }, [currentPosition, oraclePrice]);

  useEffect(() => {
    // Calculate new LTV based on current position plus new amounts using oracle price
    const newCollateral = BigInt(currentPosition?.state.collateral ?? 0) + collateralAmount;
    const newBorrow = BigInt(currentPosition?.state.borrowAssets ?? 0) + borrowAmount;

    const newCollateralValueInLoan = (newCollateral * oraclePrice) / BigInt(10 ** 36);

    if (newCollateralValueInLoan > 0) {
      const ltv = (newBorrow * BigInt(10 ** 18)) / newCollateralValueInLoan;
      setNewLTV(ltv);
    } else {
      setNewLTV(BigInt(0));
    }
  }, [currentPosition, collateralAmount, borrowAmount, oraclePrice]);

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    if (!onSuccess) return;
    try {
      onSuccess();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [onSuccess]);

  return (
    <div className="bg-surface relative w-full max-w-lg rounded-lg">
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
          {/* Position Overview Box with dynamic LTV */}
          <div className="bg-hovered mb-5 rounded-sm p-4">
            <div className="mb-3 flex items-center justify-between font-zen text-base">
              <span>My Borrow</span>
              {onSuccess && (
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  className="rounded-full p-1 transition-opacity hover:opacity-70"
                  disabled={isRefreshing}
                  aria-label="Refresh position data"
                >
                  <ReloadIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Current Position Stats */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 font-zen text-xs opacity-50">Total Collateral</p>
                <div className="flex items-center gap-2">
                  <TokenIcon
                    address={market.collateralAsset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={market.collateralAsset.symbol}
                    width={16}
                    height={16}
                  />
                  <p className="font-zen text-sm">
                    {formatBalance(BigInt(currentPosition?.state.collateral ?? 0), market.collateralAsset.decimals)}{' '}
                    {market.collateralAsset.symbol}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 font-zen text-xs opacity-50">Total Borrowed</p>
                <div className="flex items-center gap-2">
                  <TokenIcon
                    address={market.loanAsset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={market.loanAsset.symbol}
                    width={16}
                    height={16}
                  />
                  <p className="font-zen text-sm">
                    {formatBalance(BigInt(currentPosition?.state.borrowAssets ?? 0), market.loanAsset.decimals)} {market.loanAsset.symbol}
                  </p>
                </div>
              </div>
            </div>

            {/* LTV Indicator - Shows both current and projected */}
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <p className="font-zen text-sm opacity-50">Loan to Value (LTV)</p>
                <div className="font-zen text-sm">
                  {borrowAmount > 0n || collateralAmount > 0n ? (
                    <>
                      <span className="text-gray-400 line-through">{formatBalance(currentLTV, 16).toPrecision(4)}%</span>
                      <span className={`ml-2 ${getLTVColor(newLTV, lltv)}`}>{formatBalance(newLTV, 16).toPrecision(4)}%</span>
                    </>
                  ) : (
                    <span className={getLTVColor(currentLTV, lltv)}>{formatBalance(currentLTV, 16).toPrecision(4)}%</span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                {/* progress bar */}
                <div
                  className={`h-2 rounded-full transition-all duration-500 ease-in-out ${getLTVProgressColor(
                    borrowAmount > 0 || collateralAmount > 0 ? newLTV : currentLTV,
                    lltv,
                  )}`}
                  style={{
                    width: `${Math.min(
                      100,
                      (Number(borrowAmount > 0 || collateralAmount > 0 ? newLTV : currentLTV) / Number(lltv)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-end">
                <p className="font-zen text-xs text-secondary">Max LTV: {formatBalance(lltv, 16)}%</p>
              </div>
            </div>
          </div>

          {/* Market Details Block - includes position overview and collapsible details */}
          <div className="mb-5">
            <MarketDetailsBlock market={market} mode="borrow" defaultCollapsed showRewards borrowDelta={borrowAmount} />
          </div>

          {isConnected && (
            <div className="mt-12 space-y-4">
              {/* Collateral Input Section */}
              <div className="mb-1">
                <div className="flex items-center justify-between">
                  <p className="font text-sm">Add Collateral</p>
                  <p className="font text-xs opacity-50">
                    Balance:{' '}
                    {useEth
                      ? formatBalance(ethBalance ? ethBalance : '0', 18)
                      : formatBalance(collateralTokenBalance ? collateralTokenBalance : '0', market.collateralAsset.decimals)}{' '}
                    {useEth ? getNativeTokenSymbol(market.morphoBlue.chain.id) : market.collateralAsset.symbol}
                  </p>
                </div>

                {isWrappedNativeToken(market.collateralAsset.address, market.morphoBlue.chain.id) && (
                  <div className="mb-2 mt-1 flex items-center justify-end">
                    <div className="mr-2 font text-xs opacity-50">Use {getNativeTokenSymbol(market.morphoBlue.chain.id)} instead</div>
                    <Switch
                      size="sm"
                      isSelected={useEth}
                      onValueChange={setUseEth}
                      classNames={{
                        wrapper: 'w-9 h-4 mr-0',
                        thumb: 'w-3 h-3',
                      }}
                    />
                  </div>
                )}

                <div className="mb-4 flex items-start justify-between">
                  <div className="relative flex-grow">
                    <Input
                      decimals={market.collateralAsset.decimals}
                      max={useEth ? ethBalance : collateralTokenBalance}
                      setValue={setCollateralAmount}
                      setError={setCollateralInputError}
                      exceedMaxErrMessage="Insufficient Balance"
                      value={collateralAmount}
                    />
                    {collateralInputError && <p className="p-1 text-sm text-red-500">{collateralInputError}</p>}
                  </div>
                </div>
              </div>

              {/* Borrow Input Section */}
              <div className="mb-1">
                <div className="flex items-center justify-between">
                  <p className="font text-sm">Borrow </p>
                  <p className="font text-xs opacity-50">
                    Available: {formatReadable(formatBalance(market.state.liquidityAssets, market.loanAsset.decimals))}{' '}
                    {market.loanAsset.symbol}
                  </p>
                </div>

                <div className="mb-4 flex items-start justify-between">
                  <div className="relative flex-grow">
                    <Input
                      decimals={market.loanAsset.decimals}
                      setValue={setBorrowAmount}
                      setError={setBorrowInputError}
                      exceedMaxErrMessage="Exceeds available liquidity"
                      value={borrowAmount}
                    />
                    {borrowInputError && <p className="p-1 text-sm text-red-500">{borrowInputError}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-4">
            <div className="flex justify-end">
              {!isConnected ? (
                <div>
                  <AccountConnect />
                </div>
              ) : needSwitchChain ? (
                <Button onPress={switchToNetwork} className="min-w-32" variant="solid">
                  Switch Chain
                </Button>
              ) : (!permit2Authorized && !useEth) || (!usePermit2Setting && !isApproved) ? (
                <Button
                  isDisabled={
                    !isConnected ||
                    isLoadingPermit2 ||
                    borrowPending ||
                    collateralInputError !== null ||
                    borrowInputError !== null ||
                    collateralAmount === BigInt(0) ||
                    borrowAmount === BigInt(0) ||
                    newLTV >= lltv
                  }
                  onPress={() => void approveAndBorrow()}
                  className="min-w-32"
                  variant="cta"
                >
                  Approve and Borrow
                </Button>
              ) : (
                <Button
                  isDisabled={
                    !isConnected ||
                    borrowPending ||
                    collateralInputError !== null ||
                    borrowInputError !== null ||
                    (collateralAmount === BigInt(0) && borrowAmount === BigInt(0)) ||
                    newLTV >= lltv
                  }
                  onPress={() => void signAndBorrow()}
                  className="min-w-32"
                  variant="cta"
                >
                  {collateralAmount > 0n && borrowAmount == 0n ? 'Add Collateral' : 'Borrow'}
                </Button>
              )}
            </div>
            {(borrowAmount > 0n || collateralAmount > 0n) && (
              <>
                {newLTV >= lltv && <LTVWarning maxLTV={lltv} currentLTV={newLTV} type="error" />}
                {newLTV < lltv && newLTV >= (lltv * 90n) / 100n && <LTVWarning maxLTV={lltv} currentLTV={newLTV} type="danger" />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
