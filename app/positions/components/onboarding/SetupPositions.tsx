import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Slider } from '@nextui-org/react';
import { LockClosedIcon, LockOpen1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatUnits, parseUnits } from 'viem';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { SupplyProcessModal } from '@/components/SupplyProcessModal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMultiMarketSupply, MarketSupply } from '@/hooks/useMultiMarketSupply';
import { useUserBalances } from '@/hooks/useUserBalances';
import { formatBalance, formatReadable } from '@/utils/balance';
import { parseOracleVendors } from '@/utils/oracle';
import { findToken } from '@/utils/tokens';
import { useOnboarding } from './OnboardingContext';

export function SetupPositions() {
  const router = useRouter();
  const { selectedToken, selectedMarkets } = useOnboarding();
  const { balances } = useUserBalances();
  const [useEth] = useLocalStorage('useEth', false);
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [lockedAmounts, setLockedAmounts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Compute token balance and decimals
  const tokenBalance = useMemo(() => {
    if (!selectedToken) return 0n;
    return BigInt(
      balances.find((b) => b.address.toLowerCase() === selectedToken.address.toLowerCase())
        ?.balance ?? '0'
    );
  }, [balances, selectedToken]);

  const tokenDecimals = useMemo(() => selectedToken?.decimals ?? 0, [selectedToken]);

  // Redirect if no token or markets selected
  useEffect(() => {
    if (!selectedToken || !selectedMarkets || selectedMarkets.length === 0) {
      router.push('/positions/onboarding?step=risk-selection');
    }
  }, [router, selectedToken, selectedMarkets]);

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

  const handleTotalAmountChange = (value: string) => {
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
      setTotalAmount(cleanValue);
    } catch (e) {
      setError('Invalid amount');
    }
  };

  const toggleLockAmount = useCallback((marketKey: string) => {
    const newLockedAmounts = new Set(lockedAmounts);
    if (lockedAmounts.has(marketKey)) {
      newLockedAmounts.delete(marketKey);
    } else {
      newLockedAmounts.add(marketKey);
    }
    setLockedAmounts(newLockedAmounts);
  }, [lockedAmounts]);

  const handlePercentageChange = useCallback((marketKey: string, newPercentage: number) => {
    // If the input is invalid (NaN), set it to 0
    if (isNaN(newPercentage)) {
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
  }, [percentages, selectedMarkets, lockedAmounts]);

  const handleAmountChange = useCallback((marketKey: string, value: string) => {
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
  }, [totalAmount, tokenDecimals, handlePercentageChange]);

  const supplies: MarketSupply[] = useMemo(() => {
    return selectedMarkets
      .map((market) => {
        const amountStr = amounts[market.uniqueKey] ?? '0';
        try {
          const amountBigInt = parseUnits(amountStr, tokenDecimals);
          return {
            market,
            amount: amountBigInt,
          };
        } catch (e) {
          console.warn(
            `Failed to convert amount ${amountStr} to BigInt for market ${market.uniqueKey}`,
          );
          return {
            market,
            amount: 0n,
          };
        }
      })
      .filter((supply) => supply.amount > 0n);
  }, [selectedMarkets, amounts, tokenDecimals]);

  const {
    approveAndSupply,
    currentStep,
    showProcessModal,
    setShowProcessModal,
    supplyPending,
    isLoadingPermit2,
  } = useMultiMarketSupply(supplies, useEth, usePermit2Setting);

  const handleNext = useCallback(async () => {
    if (error || !totalAmount) return;

    try {
      // Validate total amount can be converted to BigInt
      const totalAmountBigInt = parseUnits(totalAmount, tokenDecimals);
      if (totalAmountBigInt === 0n) return;

      await approveAndSupply();
      // After successful supply, navigate to success page
      router.push('/positions/onboarding?step=success');
    } catch (e) {
      setError('Invalid amount format');
      return;
    }
  }, [error, totalAmount, tokenDecimals, approveAndSupply, router]);

  if (!selectedToken || !selectedMarkets || selectedMarkets.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div>
        <h2 className="font-zen text-2xl">Setup Your Positions</h2>
        <p className="mt-2 text-gray-400">
          Choose how much {selectedToken.symbol} you want to supply in total and distribute it
          across markets
        </p>
      </div>

      {/* Total Amount Section */}
      <div className="mt-6 rounded border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1">
            <div className="relative max-w-lg flex-1">
              <input
                type="text"
                value={totalAmount}
                onChange={(e) => handleTotalAmountChange(e.target.value)}
                placeholder="0.0"
                className="w-full rounded border border-gray-200 bg-white px-3 py-2 pr-20 font-mono dark:border-gray-700 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={() => handleTotalAmountChange(tokenBalance.toString())}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Max
              </button>
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
              {/* Placeholder for future swap button */}
              {/* <Button size="sm" variant="light" className="rounded">
                <SwapIcon className="h-4 w-4" />
              </Button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Markets Distribution */}
      <div className="mt-6 min-h-0 flex-1">
        <div className="h-[calc(100vh-500px)] overflow-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="w-full font-zen">
            <thead className="sticky top-0 z-[1] bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Market ID</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Collateral</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Market Params</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-normal">Supply APY</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-normal">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm dark:divide-gray-700">
              {selectedMarkets.map((market) => {
                const collateralToken = findToken(
                  market.collateralAsset.address,
                  market.morphoBlue.chain.id,
                );
                if (!collateralToken) return null;

                const { vendors } = parseOracleVendors(market.oracle.data);
                const currentPercentage = percentages[market.uniqueKey] ?? 0;
                const isLocked = lockedAmounts.has(market.uniqueKey);

                return (
                  <tr key={market.uniqueKey}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      <a
                        href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-400"
                      >
                        {market.uniqueKey.slice(2, 8)}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        {collateralToken?.img && (
                          <div className="overflow-hidden rounded-full">
                            <Image
                              src={collateralToken.img}
                              alt={market.collateralAsset.symbol}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span>{market.collateralAsset.symbol}</span>
                          <span className="text-xs text-gray-400">as collateral</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {vendors.map((vendor) => (
                            <OracleVendorBadge
                              key={vendor}
                              oracleData={market.oracle.data}
                              showText={false}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatUnits(BigInt(market.lltv), 16)}% LTV
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      {formatReadable(market.state.supplyApy * 100)}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-1 items-center gap-2">
                          <div className="flex-1">
                            <Slider
                              size="sm"
                              step={1}
                              maxValue={100}
                              minValue={0}
                              value={currentPercentage}
                              onChange={(value) =>
                                handlePercentageChange(market.uniqueKey, Number(value))
                              }
                              className="max-w-md"
                              classNames={{
                                base: 'max-w-md gap-3',
                                track: 'bg-default-500/30',
                                thumb: 'bg-primary',
                              }}
                              isDisabled={isLocked}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <input
                                type="text"
                                value={amounts[market.uniqueKey] ?? ''}
                                onChange={(e) =>
                                  handleAmountChange(market.uniqueKey, e.target.value)
                                }
                                placeholder="0.0"
                                className="bg-hovered focus:border-monarch-orange h-8 w-full rounded p-2 text-right font-mono focus:outline-none"
                                disabled={isLocked}
                              />
                            </div>
                            <span className="w-8 text-right font-mono text-gray-500">
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
                                <LockClosedIcon className="h-4 w-4" />
                              ) : (
                                <LockOpen1Icon className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        <Button
          color="primary"
          variant="light"
          className="min-w-[120px] rounded"
          onPress={() => router.push('/positions/onboarding?step=risk-selection')}
        >
          Back
        </Button>
        <Button
          color="primary"
          isDisabled={error !== null || !totalAmount || supplies.length === 0}
          isLoading={supplyPending || isLoadingPermit2}
          onPress={() => {
            void handleNext();
          }}
          className="min-w-[120px] rounded"
        >
          Execute
        </Button>
      </div>
    </div>
  );
}
