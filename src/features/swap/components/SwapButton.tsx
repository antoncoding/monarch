import type { ReactNode } from 'react';
import type { SwapToken } from '../types';

type SwapButtonProps = {
  targetToken: SwapToken;
  onOpenSwap: (targetToken: SwapToken) => void;
  children: ReactNode;
  className?: string;
};

/**
 * Simple button to trigger swap modal
 *
 * Usage:
 * ```tsx
 * const [swapTarget, setSwapTarget] = useState<SwapToken | null>(null);
 *
 * <SwapButton
 *   targetToken={{ address: '0x...', symbol: 'USDC', chainId: 1, decimals: 6 }}
 *   onOpenSwap={setSwapTarget}
 * >
 *   <span>Swap to USDC</span>
 * </SwapButton>
 *
 * {swapTarget && (
 *   <BridgeSwapModal
 *     isOpen
 *     onClose={() => setSwapTarget(null)}
 *     targetToken={swapTarget}
 *   />
 * )}
 * ```
 */
export function SwapButton({ targetToken, onOpenSwap, children, className }: SwapButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onOpenSwap(targetToken)}
      className={className}
    >
      {children}
    </button>
  );
}
