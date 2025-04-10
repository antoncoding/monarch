import React from 'react';
import { Switch } from '@nextui-org/react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useAccount } from 'wagmi';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useSupplyMarket } from '@/hooks/useSupplyMarket';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { getIRMTitle } from '@/utils/morpho';
import { isWETH } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { Button } from './common';
import { MarketInfoBlock } from './common/MarketInfoBlock';
import OracleVendorBadge from './OracleVendorBadge';
import { SupplyProcessModal } from './SupplyProcessModal';
import { TokenIcon } from './TokenIcon';

type SupplyModalContentProps = {
  market: Market;
  onClose: () => void;
  isMarketPage?: boolean;
};

export function SupplyModalContent({ market, onClose, isMarketPage }: SupplyModalContentProps): JSX.Element {
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);
  const { isConnected } = useAccount();

  // Use the hook to handle all supply logic
  const {
    supplyAmount,
    setSupplyAmount,
    inputError,
    setInputError,
    useEth,
    setUseEth,
    showProcessModal,
    setShowProcessModal,
    currentStep,
    tokenBalance,
    ethBalance,
    isApproved,
    permit2Authorized,
    isLoadingPermit2,
    supplyPending,
    approveAndSupply,
    signAndSupply,
  } = useSupplyMarket(market);

  // Use the market network hook to handle network switching
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: market.morphoBlue.chain.id,
  });

  return (
    <>
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
          {!isMarketPage && (
            <>
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
            </>
          )}

          {isConnected ? (
            <div className="mb-1 mt-8">
              {isWETH(market.loanAsset.address, market.morphoBlue.chain.id) && (
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

          <div className="mt-8 flex items-center justify-between py-4">
            <span className="opacity-80">Supply amount</span>
            {isConnected && (
              <p className="font-inter text-xs opacity-50">
                Balance: {useEth
                  ? formatBalance(ethBalance ?? BigInt(0), 18)
                  : formatBalance(tokenBalance ?? BigInt(0), market.loanAsset.decimals)
                } {useEth ? 'ETH' : market.loanAsset.symbol}
              </p>
            )}
          </div>

          <div className="mb-1 flex items-start justify-between">
            <div className="relative flex-grow">
              <Input
                decimals={market.loanAsset.decimals}
                max={useEth ? ethBalance ?? BigInt(0) : tokenBalance ?? BigInt(0)}
                setValue={setSupplyAmount}
                setError={(error: string | null | ((prev: string | null) => string | null)) => {
                  if (typeof error === 'string' && !error.includes("You don't have any supplied assets")) {
                    setInputError(error);
                  } else {
                    setInputError(null);
                  }
                }}
                exceedMaxErrMessage={supplyAmount && supplyAmount > (useEth ? ethBalance ?? BigInt(0) : tokenBalance ?? BigInt(0)) ? "Insufficient Balance" : undefined}
              />
              {inputError && !inputError.includes("You don't have any supplied assets") && (
                <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">
                  {inputError}
                </p>
              )}
            </div>

            {needSwitchChain ? (
              <Button onClick={switchToNetwork} className="ml-2 min-w-32" variant="default">
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
                disabled={!isConnected || supplyPending || inputError !== null || !supplyAmount}
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
    </>
  );
}
