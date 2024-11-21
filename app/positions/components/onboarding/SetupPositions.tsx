import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from './OnboardingContext';
import { formatBalance, formatReadable } from '@/utils/balance';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@nextui-org/react';
import Image from 'next/image';
import { useUserBalances } from '@/hooks/useUserBalances';
import { findToken } from '@/utils/tokens';

export function SetupPositions() {
  const router = useRouter();
  const { selectedToken, selectedMarkets } = useOnboarding();
  const { balances } = useUserBalances();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!selectedToken || !selectedMarkets || selectedMarkets.length === 0) {
    router.push('/positions/onboarding?step=risk-selection');
    return null;
  }

  const tokenBalance = balances?.[selectedToken.address.toLowerCase()]?.balance || 0n;
  const tokenDecimals = selectedToken.decimals;

  const handleAmountChange = (marketKey: string, value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) return;
    
    // Limit decimal places to token decimals
    if (parts[1] && parts[1].length > tokenDecimals) return;

    setAmounts(prev => ({ ...prev, [marketKey]: cleanValue }));

    // Validate total amount
    try {
      const totalBigInt = Object.values(amounts).reduce((acc, val) => {
        if (!val) return acc;
        return acc + parseUnits(val, tokenDecimals);
      }, 0n);

      if (totalBigInt > tokenBalance) {
        setError('Total amount exceeds balance');
      } else {
        setError(null);
      }
    } catch (e) {
      // Handle parsing errors
      setError('Invalid amount');
    }
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
          Choose how much {selectedToken.symbol} you want to supply to each market
        </p>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Available Balance:</span>
          <span className="font-mono">
            {formatBalance(tokenBalance, tokenDecimals)} {selectedToken.symbol}
          </span>
        </div>
      </div>

      <div className="mt-6 flex-1 min-h-0">
        <div className="h-[calc(100vh-400px)] overflow-auto">
          <table className="w-full rounded-md font-zen">
            <thead className="sticky top-0 z-10 bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 text-left">Market</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">Supply APY</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {selectedMarkets.map((market) => {
                const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
                if (!collateralToken) return null;

                return (
                  <tr
                    key={market.uniqueKey}
                    className="border-b border-gray-200 dark:border-gray-700"
                  >
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex items-center gap-2">
                        {collateralToken?.img && (
                          <Image
                            src={collateralToken.img}
                            alt={market.collateralAsset.symbol}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        )}
                        <div className="flex flex-col">
                          <span>{market.collateralAsset.symbol}</span>
                          <span className="text-xs text-gray-400">as collateral</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {formatReadable(market.state.supplyApy * 100)}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="text"
                          value={amounts[market.uniqueKey] || ''}
                          onChange={(e) => handleAmountChange(market.uniqueKey, e.target.value)}
                          placeholder="0.0"
                          className="w-36 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-right font-mono dark:border-gray-700"
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
      <div className="mt-6 flex items-center justify-between border-t border-gray-700/50 pt-4">
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
          disabled={!!error}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
