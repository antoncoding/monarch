import { useState, useMemo, } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common';
import { MarketInfoBlock } from '@/components/common/MarketInfoBlock';
import { useOnboarding } from './OnboardingContext';
import { MarketCap, useAuthorizeAgent } from '@/hooks/useAuthorizeAgent';
import useUserPositions from '@/hooks/useUserPositions';
import { AgentSetupProcessModal } from '@/components/AgentSetupProcessModal';
import { Market } from '@/utils/types';
import { maxUint256 } from 'viem';

export function SetupAgent({ onClose }: { onClose: () => void }) {
  const chainId = useChainId();
  const [showProcessModal, setShowProcessModal] = useState(false);
  const { selectedToken: selectedTokenFromOnboarding, selectedMarkets: marketsFromOnboarding } = useOnboarding();

  const { address: account } = useAccount()
  const { data: positions } = useUserPositions(account, true);

  // todo: if not from onboarding flow, handle it separately
  const selectedToken = useMemo(() => {
    return selectedTokenFromOnboarding;
  }, [selectedTokenFromOnboarding]);

  // todo: if not from onboarding flow, handle it separately
  const defaultSelectedMarkets = useMemo(() => {
    const marketsFromPositions = positions?.map((p) => p.market)
      .filter((m) => m.loanAsset.address.toLowerCase() === selectedToken?.address.toLowerCase() || !selectedToken) ?? [];
    
    // combine both and remove duplicates
    const combinedMarkets = [...marketsFromOnboarding, ...marketsFromPositions];
    return [...new Set(combinedMarkets)];
  }, [marketsFromOnboarding, positions]);


  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>(defaultSelectedMarkets);

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
        amount: maxUint256
      } as MarketCap
    });
  }, [selectedMarkets, tokenDecimals]);

  const {
    currentStep,
    executeBatchSetupAgent
  } = useAuthorizeAgent(caps, );

  return (
    <div className="flex h-full flex-col">
      {/* Total Amount Section */}
      
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
          onPress={() => void executeBatchSetupAgent()}
          className="min-w-[120px]"
        >
          Execute
        </Button>
      </div>
    </div>
  );
}
