import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from './OnboardingContext';
import { formatBalance, formatReadable } from '@/utils/balance';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@nextui-org/react';
import Image from 'next/image';
import { useUserBalances } from '@/hooks/useUserBalances';
import { findToken } from '@/utils/tokens';
import { parseOracleVendors } from '@/utils/oracle';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { Market } from '@/utils/types';

export function SetupPositions() {
  const router = useRouter();
  const { selectedToken, selectedMarkets } = useOnboarding();
  const { balances } = useUserBalances();
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!selectedToken || !selectedMarkets || selectedMarkets.length === 0) {
    router.push('/positions/onboarding?step=risk-selection');
    return null;
  }

  const tokenBalance = BigInt(balances.find(b => b.address.toLowerCase() === selectedToken.address.toLowerCase())?.balance || '0') || 0n;
  const tokenDecimals = selectedToken.decimals;

  // Initialize amounts evenly
  useEffect(() => {
    if (selectedMarkets.length > 0 && totalAmount) {
      const evenAmount = Number(totalAmount) / selectedMarkets.length;
      const initialAmounts = selectedMarkets.reduce((acc, market) => {
        acc[market.uniqueKey] = evenAmount.toFixed(tokenDecimals);
        return acc;
      }, {} as Record<string, string>);
      setAmounts(initialAmounts);
    }
  }, [selectedMarkets.length, totalAmount, tokenDecimals]);

  const handleTotalAmountChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) return;
    
    // Limit decimal places to token decimals
    if (parts[1] && parts[1].length > tokenDecimals) return;

    setTotalAmount(cleanValue);

    try {
      const amountBigInt = parseUnits(cleanValue || '0', tokenDecimals);
      if (amountBigInt > tokenBalance) {
        setError('Amount exceeds balance');
      } else {
        setError(null);
      }
    } catch (e) {
      setError('Invalid amount');
    }
  };

  const handleAmountChange = (marketKey: string, value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) return;
    
    // Limit decimal places to token decimals
    if (parts[1] && parts[1].length > tokenDecimals) return;

    const newAmounts = { ...amounts, [marketKey]: cleanValue };
    setAmounts(newAmounts);

    // Calculate and update total
    try {
      const total = Object.values(newAmounts).reduce((sum, val) => sum + (Number(val) || 0), 0);
      setTotalAmount(total.toFixed(tokenDecimals));

      const totalBigInt = parseUnits(total.toFixed(tokenDecimals), tokenDecimals);
      if (totalBigInt > tokenBalance) {
        setError('Total amount exceeds balance');
      } else {
        setError(null);
      }
    } catch (e) {
      setError('Invalid amount');
    }
  };

  const handleSetMax = () => {
    const maxAmount = formatUnits(tokenBalance, tokenDecimals);
    setTotalAmount(maxAmount);
    
    // Distribute evenly
    const evenAmount = Number(maxAmount) / selectedMarkets.length;
    const newAmounts = selectedMarkets.reduce((acc, market) => {
      acc[market.uniqueKey] = evenAmount.toFixed(tokenDecimals);
      return acc;
    }, {} as Record<string, string>);
    setAmounts(newAmounts);
  };

  const handleNext = () => {
    if (error) return;
    
    // Convert amounts to BigInt and validate
    const positions = selectedMarkets.map(market => ({
      market,
      amount: amounts[market.uniqueKey]
        ? parseUnits(amounts[market.uniqueKey], tokenDecimals)
        : 0n
    }));

    // TODO: Handle position creation
    console.log('Creating positions:', positions);
  };

  return (
    <div className="flex h-full flex-col">
      <div>
        <h2 className="font-zen text-2xl">Setup Your Positions</h2>
        <p className="mt-2 text-gray-400">
          Choose how much {selectedToken.symbol} you want to supply in total and distribute it across markets
        </p>
      </div>

      {/* Total Amount Section */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <label className="mb-2 block text-sm text-gray-500">Total Amount to Supply</label>
            <div className="relative">
              <input
                type="text"
                value={totalAmount}
                onChange={(e) => handleTotalAmountChange(e.target.value)}
                placeholder="0.0"
                className="bg-hovered focus:border-monarch-orange h-10 w-full rounded p-2 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSetMax}
                className="bg-surface absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 text-sm text-secondary opacity-80 duration-300 ease-in-out hover:scale-105 hover:opacity-100"
              >
                Max
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-gray-500">Available Balance</span>
            <span className="font-mono text-sm">
              {formatBalance(tokenBalance, tokenDecimals)} {selectedToken.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Markets Distribution */}
      <div className="mt-6 flex-1 min-h-0">
        <div className="h-[calc(100vh-500px)] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full font-zen">
            <thead className="sticky top-0 z-[1] bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Market ID</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Collateral</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-normal">Risk Indicators</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-normal">Supply APY</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm dark:divide-gray-700">
              {selectedMarkets.map((market) => {
                const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
                if (!collateralToken) return null;

                const { vendors } = parseOracleVendors(market.oracle.data);

                return (
                  <tr key={market.uniqueKey}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                      {market.uniqueKey.slice(2, 8)}
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
                            <OracleVendorBadge key={vendor} oracleData={market.oracle.data} showText={false} />
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
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="text"
                          value={amounts[market.uniqueKey] || ''}
                          onChange={(e) => handleAmountChange(market.uniqueKey, e.target.value)}
                          placeholder="0.0"
                          className="bg-hovered focus:border-monarch-orange h-8 w-36 rounded p-2 text-right font-mono focus:outline-none"
                        />
                        <span className="w-12 text-gray-500">{selectedToken.symbol}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="light"
          onClick={() => router.push('/positions/onboarding?step=risk-selection')}
        >
          Back
        </Button>
        <Button
          color="primary"
          className="min-w-[120px]"
          onClick={handleNext}
          disabled={!!error || !totalAmount || Number(totalAmount) === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
