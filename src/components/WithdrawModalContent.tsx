// Import the necessary hooks
import { useCallback, useState } from 'react';

import { Address, encodeFunctionData } from 'viem';
import { useAccount } from 'wagmi';
import morphoAbi from '@/abis/morpho';
import { MarketInfoBlock } from '@/components/common/MarketInfoBlock';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatReadable, min } from '@/utils/balance';
import { MORPHO } from '@/utils/morpho';
import { Market, MarketPosition } from '@/utils/types';
import { Button } from './common';
import { TokenIcon } from './TokenIcon';

type WithdrawModalContentProps = {
  position?: MarketPosition;
  market?: Market;
  onClose: () => void;
  refetch: () => void;
  isMarketPage?: boolean;
};

export function WithdrawModalContent({ position, market, onClose, refetch, isMarketPage }: WithdrawModalContentProps): JSX.Element {
  const toast = useStyledToast();
  const [inputError, setInputError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<bigint>(BigInt(0));

  const { address: account, isConnected, chainId } = useAccount();

  // Use market from either position or direct prop
  const activeMarket = position?.market ?? market;

  if (!activeMarket) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-center text-red-500">Market data not available</p>
      </div>
    );
  }

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: activeMarket.morphoBlue.chain.id,
  });

  const { isConfirming, sendTransaction } = useTransactionWithToast({
    toastId: 'withdraw',
    pendingText: `Withdrawing ${formatBalance(
      withdrawAmount,
      activeMarket.loanAsset.decimals,
    )} ${activeMarket.loanAsset.symbol}`,
    successText: `${activeMarket.loanAsset.symbol} Withdrawn`,
    errorText: 'Failed to withdraw',
    chainId,
    pendingDescription: `Withdrawing from market ${activeMarket.uniqueKey.slice(2, 8)}...`,
    successDescription: `Successfully withdrawn from market ${activeMarket.uniqueKey.slice(
      2,
      8,
    )}`,
    onSuccess: () => {
      refetch();
      onClose();
    },
  });

  const withdraw = useCallback(async () => {
    if (!account) {
      toast.info('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    if (!position) {
      toast.error('No position', 'You do not have a position in this market to withdraw from.');
      return;
    }

    const isMax = withdrawAmount.toString() === position.state.supplyAssets.toString();

    const assetsToWithdraw = isMax ? '0' : withdrawAmount.toString();
    const sharesToWithdraw = isMax ? position.state.supplyShares : '0';

    sendTransaction({
      account,
      to: MORPHO,
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
  }, [
    account,
    activeMarket,
    position,
    withdrawAmount,
    sendTransaction,
    position?.state.supplyAssets,
    position?.state.supplyShares,
    toast,
  ]);

  return (
    <div className="flex flex-col">
      {!isMarketPage && (
        <>
          <MarketInfoBlock market={activeMarket} />
        </>
      )}

      {!isConnected && (
        <div className="flex justify-center">
          <div className="items-center justify-center pt-4">
            <AccountConnect />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between py-4">
        <span className="opacity-80">Withdraw amount</span>
        <p className="font-inter text-xs opacity-50">
          Market Liquidity: {formatReadable(
            formatBalance(activeMarket.state.liquidityAssets, activeMarket.loanAsset.decimals)
          )} {activeMarket.loanAsset.symbol}
        </p>
      </div>

      <div className="mb-1 flex items-start justify-between">
        <div className="relative flex-grow">
          <Input
            decimals={activeMarket.loanAsset.decimals}
            max={position ? min(
              BigInt(position.state.supplyAssets),
              BigInt(activeMarket.state.liquidityAssets),
            ) : BigInt(0)}
            setValue={setWithdrawAmount}
            setError={setInputError}
            exceedMaxErrMessage="Insufficient Liquidity"
            allowExceedMax
          />
          {inputError && <p className="p-1 text-sm text-red-500">{inputError}</p>}
        </div>
        {needSwitchChain ? (
          <Button
            onClick={switchToNetwork}
            className="ml-2 min-w-32"
            variant="default"
          >
            Switch Chain
          </Button>
        ) : (
          <Button
            disabled={!isConnected || isConfirming || !position}
            onClick={() => void withdraw()}
            className="ml-2 min-w-32"
            variant="cta"
          >
            {position ? 'Withdraw' : 'No Position'}
          </Button>
        )}
      </div>
    </div>
  );
}
