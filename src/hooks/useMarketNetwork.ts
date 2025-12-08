import { useCallback, useMemo } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { useStyledToast } from '@/hooks/useStyledToast';

type UseMarketNetworkProps = {
  targetChainId: number;

  onNetworkSwitched?: () => void;
};

type UseMarketNetworkReturn = {
  /**
   * Whether the user needs to switch networks to interact with the market or chain
   */
  needSwitchChain: boolean;

  /**
   * The function to call to switch to the correct network
   */
  switchToNetwork: () => void;

  /**
   * The current chain ID the user is connected to
   */
  currentChainId?: number;

  /**
   * The target chain ID for the market or direct input
   */
  targetChainId: number;
};

/**
 * A hook that manages network compatibility for markets or specific chains
 *
 * It checks if the user is on the correct network and provides a function
 * to switch to the correct network when needed
 */
export function useMarketNetwork({ targetChainId, onNetworkSwitched }: UseMarketNetworkProps): UseMarketNetworkReturn {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const toast = useStyledToast();

  // Check if chain switch is needed
  const needSwitchChain = useMemo(() => chainId !== targetChainId, [chainId, targetChainId]);

  // Function to switch to the target network
  const switchToNetwork = useCallback(() => {
    if (needSwitchChain) {
      try {
        switchChain({ chainId: targetChainId });
        onNetworkSwitched?.();
      } catch (error) {
        toast.error('Network Switch Failed', 'Failed to switch to the required network');
        console.error('Failed to switch networks:', error);
      }
    }
  }, [targetChainId, needSwitchChain, switchChain, toast]);

  return {
    needSwitchChain,
    switchToNetwork,
    currentChainId: chainId,
    targetChainId,
  };
}
