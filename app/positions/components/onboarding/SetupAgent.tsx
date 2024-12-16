import { useState, useMemo } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common';
import { MarketInfoBlockCompact } from '@/components/common/MarketInfoBlock';
import { useOnboarding } from './OnboardingContext';
import { MarketCap, useAuthorizeAgent } from '@/hooks/useAuthorizeAgent';
import { AgentSetupProcessModal } from '@/components/AgentSetupProcessModal';
import { Market } from '@/utils/types';
import { maxUint256 } from 'viem';

export function SetupAgent({
  onClose,
  defaultMarkets,
}: {
  onClose: () => void;
  defaultMarkets: Market[];
}) {
  const chainId = useChainId();
  const [showProcessModal, setShowProcessModal] = useState(false);
  const { selectedToken: selectedTokenFromOnboarding } = useOnboarding();

  // todo: if not from onboarding flow, handle it separately
  const selectedToken = useMemo(() => {
    return selectedTokenFromOnboarding;
  }, [selectedTokenFromOnboarding]);

  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>(defaultMarkets);

  const needSwitchChain = useMemo(
    () => chainId !== selectedToken?.network,
    [chainId, selectedToken],
  );

  const { switchChain } = useSwitchChain();

  const tokenDecimals = useMemo(() => selectedToken?.decimals ?? 0, [selectedToken]);

  const caps = useMemo(() => {
    // uint256
    return selectedMarkets.map((market) => {
      return {
        market: market,
        amount: maxUint256,
      } as MarketCap;
    });
  }, [selectedMarkets, tokenDecimals]);

  const { currentStep, executeBatchSetupAgent } = useAuthorizeAgent(caps);

  return (
    <div className="flex h-full flex-col">
      {/* Authorization Info */}
      <div className="mb-6">
        <h2 className="mb-2 text-xl">Authorize Monarch Agent </h2>
        <p className="text-gray-400">
          The Monarch Agent will be authorized to manage your positions in the selected markets. You
          can modify the selection below.
        </p>
      </div>

      {/* Markets Section */}
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text font-medium">Selected Markets</h3>
          <span className="text-sm text-gray-400">
            {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
          {selectedMarkets.map((market) => (
            <div className="flex w-full">
              <MarketInfoBlockCompact market={market} />
            </div>
          ))}
        </div>

        {selectedMarkets.length === 0 && (
          <div className="py-8 text-center text-gray-400">
            No markets selected. Please select at least one market to continue.
          </div>
        )}
      </div>

      {/* Process Modal */}
      {showProcessModal && (
        <AgentSetupProcessModal
          caps={caps}
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
        />
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="light" className="min-w-[120px]" onPress={onClose}>
          Cancel
        </Button>
        <Button
          variant="cta"
          onPress={() => {
            if (needSwitchChain && selectedToken?.network) {
              switchChain({ chainId: selectedToken.network });
              return;
            }
            setShowProcessModal(true);
            executeBatchSetupAgent();
          }}
          className="min-w-[120px]"
          isDisabled={selectedMarkets.length === 0}
        >
          {'Authorize'}
        </Button>
      </div>
    </div>
  );
}
