// Import the necessary hooks
import { useCallback, useState } from 'react';
import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatReadable, min } from '@/utils/balance';
import { getMorphoAddress } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { Market, MarketPosition } from '@/utils/types';
import { Button } from './common';

type WithdrawModalContentProps = {
  position?: MarketPosition | null;
  market?: Market;
  onClose: () => void;
  refetch: () => void;
  onAmountChange?: (amount: bigint) => void;
};

export function WithdrawModalContent({
  position,
  market,
  onClose,
  refetch,
  onAmountChange,
}: WithdrawModalContentProps): JSX.Element {
  const toast = useStyledToast();
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));

  // Notify parent component when withdraw amount changes
  const handleWithdrawAmountChange = useCallback(
    (amount: bigint) => {
      setWithdrawAmount(amount);
      onAmountChange?.(amount);
    },
    [onAmountChange],
  );
  const { address: account, isConnected, chainId } = useAccount();

  // Prefer the market prop (which has fresh state) over position.market
  const activeMarket = market ?? position?.market;

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: activeMarket?.morphoBlue.chain.id ?? 0,
  });

  const { isConfirming, sendTransaction } = useTransactionWithToast({
    toastId: 'withdraw',
    pendingText: activeMarket
      ? `Withdrawing ${formatBalance(withdrawAmount, activeMarket.loanAsset.decimals)} ${
          activeMarket.loanAsset.symbol
        }`
      : '',
    successText: activeMarket ? `${activeMarket.loanAsset.symbol} Withdrawn` : '',
    errorText: 'Failed to withdraw',
    chainId,
    pendingDescription: activeMarket
      ? `Withdrawing from market ${activeMarket.uniqueKey.slice(2, 8)}...`
      : '',
    successDescription: activeMarket
      ? `Successfully withdrawn from market ${activeMarket.uniqueKey.slice(2, 8)}`
      : '',
    onSuccess: () => {
      refetch();
      onClose();
    },
  });

  const withdraw = useCallback(async () => {
    if (!activeMarket) {
      toast.error('No market', 'Market data not available');
      return;
    }

    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    // Calculate withdraw parameters - use asset-based withdrawal if no position detected
    let assetsToWithdraw: string;
    let sharesToWithdraw: string;

    if (position) {
      const isMax = withdrawAmount.toString() === position.state.supplyAssets.toString();
      assetsToWithdraw = isMax ? '0' : withdrawAmount.toString();
      sharesToWithdraw = isMax ? position.state.supplyShares : '0';
    } else {
      // No position detected - use asset-based withdrawal
      assetsToWithdraw = withdrawAmount.toString();
      sharesToWithdraw = '0';
    }

    sendTransaction({
      account,
      to: getMorphoAddress(activeMarket.morphoBlue.chain.id as SupportedNetworks),
      data: encodeFunctionData({
        abi: morphoAbi,
        functionName: 'withdraw',
        args: [
          {
            loanToken: activeMarket.loanAsset.address as Address,
            collateralToken: activeMarket.collateralAsset.address as Address,
            oracle: activeMarket.oracleAddress as Address,
            irm: activeMarket.irmAddress as Address,
            lltv: BigInt(activeMarket.lltv),
          },
          BigInt(assetsToWithdraw),
          BigInt(sharesToWithdraw),
          account, // onBehalf
          account, // receiver
        ],
      }),
      chainId: activeMarket.morphoBlue.chain.id,
    });
  }, [account, activeMarket, position, withdrawAmount, sendTransaction, toast]);

  if (!activeMarket) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-center text-red-500">Market data not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {!isConnected ? (
        <div className="flex justify-center py-4">
          <AccountConnect />
        </div>
      ) : (
        <>
          {/* Withdraw Input Section */}
          <div className="mt-12 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="opacity-80">Withdraw amount</span>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-inter text-xs opacity-50">
                    Available:{' '}
                    {formatReadable(
                      formatBalance(
                        position?.state.supplyAssets ?? BigInt(0),
                        activeMarket.loanAsset.decimals,
                      ),
                    )}{' '}
                    {activeMarket.loanAsset.symbol}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-start justify-between">
                <div className="relative flex-grow">
                  <Input
                    decimals={activeMarket.loanAsset.decimals}
                    max={
                      position
                        ? min(
                            BigInt(position.state.supplyAssets),
                            BigInt(activeMarket.state.liquidityAssets),
                          )
                        : BigInt(0)
                    }
                    setValue={handleWithdrawAmountChange}
                    setError={setInputError}
                    exceedMaxErrMessage="Insufficient Liquidity"
                    error={inputError}
                  />
                </div>
                {needSwitchChain ? (
                  <Button onPress={switchToNetwork} className="ml-2 min-w-32" variant="secondary">
                    Switch Chain
                  </Button>
                ) : (
                  <Button
                    isDisabled={!isConnected || isConfirming || !withdrawAmount}
                    onPress={() => void withdraw()}
                    className="ml-2 min-w-32"
                    variant="cta"
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
