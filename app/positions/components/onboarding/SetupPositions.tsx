import { useState, useEffect, useMemo, useCallback } from 'react';
import { Slider } from '@heroui/react';
import { LockClosedIcon, LockOpen1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/common';
import Input from '@/components/Input/Input';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';
import { SupplyProcessModal } from '@/components/SupplyProcessModal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMultiMarketSupply } from '@/hooks/useMultiMarketSupply';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatBalance } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import { APYCell } from 'app/markets/components/APYBreakdownTooltip';
import { useOnboarding } from './OnboardingContext';

export function SetupPositions() {
  const toast = useStyledToast();
  const { selectedToken, selectedMarkets, goToNextStep, goToPrevStep, balances } = useOnboarding();
  const [useEth] = useLocalStorage('useEth', false);
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [totalAmountBigInt, setTotalAmountBigInt] = useState<bigint>(0n);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [lockedAmounts, setLockedAmounts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSupplying, setIsSupplying] = useState(false);

  // Use our custom hook for network switching
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: selectedToken?.network ?? SupportedNetworks.Base,
  });

  // Compute token balance and decimals
  const tokenBalance = useMemo(() => {
    if (!selectedToken) return 0n;
    return BigInt(
      balances.find((b) => b.address.toLowerCase() === selectedToken.address.toLowerCase())
        ?.balance ?? '0',
    );
  }, [balances, selectedToken]);

  const tokenDecimals = useMemo(() => selectedToken?.decimals ?? 0, [selectedToken]);

  // Sync BigInt value to string value for calculations
  useEffect(() => {
    const formattedAmount = formatUnits(totalAmountBigInt, tokenDecimals);
    setTotalAmount(formattedAmount);
  }, [totalAmountBigInt, tokenDecimals]);

  // Initialize percentages evenly
  useEffect(() => {
    if (selectedMarkets.length > 0) {
      const evenPercentage = 100 / selectedMarkets.length;
      const initialPercentages = selectedMarkets.reduce(
        (acc, market) => {
          acc[market.uniqueKey] = evenPercentage;
          return acc;
        },
        {} as Record<string, number>,
      );
      setPercentages(initialPercentages);
    }
  }, [selectedMarkets]);

  // Update amounts when total amount or percentages change
  useEffect(() => {
    if (totalAmount && Object.keys(percentages).length > 0) {
      const newAmounts = Object.entries(percentages).reduce(
        (acc, [key, percentage]) => {
          acc[key] = ((percentage / 100) * Number(totalAmount)).toFixed(tokenDecimals);
          return acc;
        },
        {} as Record<string, string>,
      );
      setAmounts(newAmounts);
    }
  }, [totalAmount, percentages, tokenDecimals]);


  const toggleLockAmount = useCallback(
    (marketKey: string) => {
      const newLockedAmounts = new Set(lockedAmounts);
      if (lockedAmounts.has(marketKey)) {
        newLockedAmounts.delete(marketKey);
      } else {
        newLockedAmounts.add(marketKey);
      }
      setLockedAmounts(newLockedAmounts);
    },
    [lockedAmounts],
  );

  const handlePercentageChange = useCallback(
    (marketKey: string, newPercentage: number) => {
      // If the input is invalid (NaN), set it to 0
      if (Number.isNaN(newPercentage)) {
        newPercentage = 0;
      }

      const market = selectedMarkets.find((m) => m.uniqueKey === marketKey);
      if (!market) return;

      const lockedMarkets = selectedMarkets.filter(
        (m) => m.uniqueKey !== marketKey && lockedAmounts.has(m.uniqueKey),
      );
      const unlockedMarkets = selectedMarkets.filter(
        (m) => m.uniqueKey !== marketKey && !lockedAmounts.has(m.uniqueKey),
      );

      // Calculate total locked percentage
      const totalLockedPercentage = lockedMarkets.reduce(
        (sum, m) => sum + (percentages[m.uniqueKey] || 0),
        0,
      );

      // Ensure we don't exceed 100% - totalLockedPercentage
      const maxAllowedPercentage = 100 - totalLockedPercentage;
      newPercentage = Math.min(newPercentage, maxAllowedPercentage);

      // Calculate remaining percentage for unlocked markets
      const remainingPercentage = 100 - totalLockedPercentage - newPercentage;

      // Distribute remaining percentage among unlocked markets proportionally
      const newPercentages = { ...percentages };
      newPercentages[marketKey] = newPercentage;

      if (unlockedMarkets.length > 0 && remainingPercentage > 0) {
        const currentUnlockedTotal = unlockedMarkets.reduce(
          (sum, m) => sum + (percentages[m.uniqueKey] || 0),
          0,
        );

        unlockedMarkets.forEach((m) => {
          const currentPct = percentages[m.uniqueKey] || 0;
          const proportion =
            currentUnlockedTotal === 0
              ? 1 / unlockedMarkets.length
              : currentPct / currentUnlockedTotal;
          newPercentages[m.uniqueKey] = remainingPercentage * proportion;
        });
      }

      setPercentages(newPercentages);
    },
    [percentages, selectedMarkets, lockedAmounts],
  );

  const handleAmountChange = useCallback(
    (marketKey: string, value: string) => {
      if (!totalAmount) return;

      // Remove any non-numeric characters except decimal point
      const cleanValue = value.replace(/[^0-9.]/g, '');

      // Ensure only one decimal point
      const parts = cleanValue.split('.');
      if (parts.length > 2) return;

      // Limit decimal places to token decimals
      if (parts[1] && parts[1].length > tokenDecimals) return;

      try {
        // Validate the new amount can be converted to BigInt
        parseUnits(cleanValue || '0', tokenDecimals);

        const newAmount = Number(cleanValue);
        const percentage = (newAmount / Number(totalAmount)) * 100;

        // Update this market's percentage
        handlePercentageChange(marketKey, percentage);
      } catch (e) {
        // If conversion fails, don't update the state
        console.warn(`Invalid amount format: ${cleanValue}`);
        return;
      }
    },
    [totalAmount, tokenDecimals, handlePercentageChange],
  );

  const supplies = useMemo(() => {
    if (!selectedMarkets || !amounts || !tokenDecimals) return [];

    return selectedMarkets
      .map((market) => {
        const amount = parseUnits(amounts[market.uniqueKey] || '0', tokenDecimals);
        return {
          market,
          amount,
        };
      })
      .filter((supply) => supply.amount > 0n);
  }, [selectedMarkets, amounts, tokenDecimals]);

  const {
    currentStep,
    showProcessModal,
    setShowProcessModal,
    isLoadingPermit2,
    approveAndSupply,
    supplyPending,
  } = useMultiMarketSupply(selectedToken!, supplies, useEth, usePermit2Setting, goToNextStep);

  const handleSupply = async () => {
    if (isSupplying) {
      toast.info('Loading', 'Supplying in progress');
      return;
    }

    if (needSwitchChain && selectedToken) {
      try {
        switchToNetwork();
        // Wait for network switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError) {
        toast.error('Failed to switch network', 'Please try again');
        return;
      }
    }
    setIsSupplying(true);

    try {
      // trigger the tx. goToNextStep() be called as a `onSuccess` callback
      await approveAndSupply();
    } catch (supplyError) {
    } finally {
      setIsSupplying(false);
    }
  };

  if (!selectedToken || !selectedMarkets || selectedMarkets.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Total Amount Section */}
      <div className="mt-6 rounded border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1">
            <div className="relative max-w-lg flex-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Supply amount</span>
                </div>
                <Input
                  decimals={tokenDecimals}
                  max={tokenBalance}
                  setValue={setTotalAmountBigInt}
                  setError={setError}
                  exceedMaxErrMessage={
                    totalAmountBigInt > tokenBalance
                      ? 'Insufficient Balance'
                      : undefined
                  }
                />
                {error && (
                  <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex min-w-[200px] flex-col items-end">
            <div className="flex items-center gap-2">
              <Image
                src={selectedToken.logoURI ?? ''}
                alt={selectedToken.symbol}
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="text-sm text-gray-500">Wallet Balance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">
                {formatBalance(tokenBalance, tokenDecimals)} {selectedToken.symbol}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Markets Distribution */}
      <div className="mt-6 h-96 overflow-y-auto">
        <table className="responsive w-full rounded-md font-zen">
          <thead className="table-header">
            <tr>
              <th className="font-normal">Market</th>
              <th className="font-normal">APY</th>
              <th className="font-normal">Distribution</th>
            </tr>
          </thead>
          <tbody className="table-body text-sm">
            {selectedMarkets.map((market) => {
              const currentPercentage = percentages[market.uniqueKey] ?? 0;
              const isLocked = lockedAmounts.has(market.uniqueKey);

              return (
                <tr key={market.uniqueKey} className="hover:bg-hovered">
                  {/* Market Identity */}
                  <td data-label="Market" className="z-50" style={{ width: '280px' }}>
                    <MarketIdentity
                      market={market}
                      chainId={market.morphoBlue.chain.id}
                      mode={MarketIdentityMode.Focused}
                      focus={MarketIdentityFocus.Collateral}
                      showLltv
                      showOracle
                      iconSize={18}
                      showExplorerLink
                    />
                  </td>

                  {/* APY */}
                  <td data-label="APY">
                    <APYCell market={market} />
                  </td>

                  {/* Distribution Controls */}
                  <td data-label="Distribution" className="z-50">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <Slider
                          size="sm"
                          step={1}
                          maxValue={100}
                          minValue={0}
                          value={currentPercentage}
                          onChange={(value) =>
                            handlePercentageChange(market.uniqueKey, Number(value))
                          }
                          className="w-full"
                          classNames={{
                            base: 'w-full gap-2',
                          }}
                          isDisabled={isLocked}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <input
                            type="text"
                            value={amounts[market.uniqueKey] ?? ''}
                            onChange={(e) =>
                              handleAmountChange(market.uniqueKey, e.target.value)
                            }
                            placeholder="0.0"
                            className="bg-hovered focus:border-primary h-7 w-full rounded px-2 text-right font-mono text-xs focus:outline-none"
                            disabled={isLocked}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-xs text-gray-500">
                          {Math.round(currentPercentage)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleLockAmount(market.uniqueKey)}
                          className={`text-primary hover:text-primary-400 ${
                            isLocked ? 'opacity-100' : 'opacity-60'
                          }`}
                        >
                          {isLocked ? (
                            <LockClosedIcon className="h-3 w-3" />
                          ) : (
                            <LockOpen1Icon className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}

      {/* Process Modal */}
      {showProcessModal && (
        <SupplyProcessModal
          supplies={supplies}
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          tokenSymbol={selectedToken.symbol}
          useEth={useEth}
          usePermit2={usePermit2Setting}
        />
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="light" className="min-w-[120px]" onPress={goToPrevStep}>
          Back
        </Button>
        <Button
          variant="cta"
          isDisabled={error !== null || totalAmountBigInt === 0n || supplies.length === 0}
          isLoading={supplyPending || isLoadingPermit2}
          onPress={() => void handleSupply()}
          className="min-w-[120px]"
        >
          Execute
        </Button>
      </div>
    </div>
  );
}
