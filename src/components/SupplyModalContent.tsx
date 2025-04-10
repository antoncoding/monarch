import React from 'react';
import { Switch } from '@nextui-org/react';
import { useAccount } from 'wagmi';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useSupplyMarket } from '@/hooks/useSupplyMarket';
import { formatBalance } from '@/utils/balance';
import { isWETH } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { Button } from './common';
import { SupplyProcessModal } from './SupplyProcessModal';
import useUserPosition from '@/hooks/useUserPosition';

type SupplyModalContentProps = {
  market: Market;
  onClose: () => void;
  isMarketPage?: boolean;
};

export function SupplyModalContent({ market, onClose, isMarketPage }: SupplyModalContentProps): JSX.Element {
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);
  const { isConnected } = useAccount();
  const { address: account } = useAccount();
  
  // Get user position
  const { position } = useUserPosition(
    account,
    market.morphoBlue.chain.id,
    market.uniqueKey,
  );

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
          supplies={[{ market, amount: supplyAmount }]}
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          tokenSymbol={market.loanAsset.symbol}
          useEth={useEth}
          usePermit2={usePermit2Setting}
        />
      )}
      {!showProcessModal && (
        <div className="flex flex-col">
          {!isConnected ? (
            <div className="flex justify-center py-4">
              <AccountConnect />
            </div>
          ) : (
            <>
              {/* Supply Input Section */}
              <div className="space-y-4 mt-12">
                {isWETH(market.loanAsset.address, market.morphoBlue.chain.id) && (
                  <div className="flex items-center justify-end gap-2">
                    <div className="font-inter text-xs opacity-50">Use ETH instead</div>
                    <Switch
                      size="sm"
                      isSelected={useEth}
                      onValueChange={setUseEth}
                      className="h-4 w-4"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">Supply amount</span>
                    <p className="font-inter text-xs opacity-50">
                      Balance: {useEth
                        ? formatBalance(ethBalance ?? BigInt(0), 18)
                        : formatBalance(tokenBalance ?? BigInt(0), market.loanAsset.decimals)
                      } {useEth ? 'ETH' : market.loanAsset.symbol}
                    </p>
                  </div>

                  <div className="mt-2 flex items-start justify-between">
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
                        Supply
                      </Button>
                    ) : (
                      <Button
                        disabled={!isConnected || supplyPending || inputError !== null || !supplyAmount}
                        onClick={() => void signAndSupply()}
                        className="ml-2 min-w-32"
                        variant="cta"
                      >
                        Supply
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
