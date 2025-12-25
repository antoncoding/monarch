import type { ReactNode } from 'react';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { BridgeSwapModal } from './BridgeSwapModal';
import type { SwapToken } from '../types';

type SwapButtonProps = {
  targetToken: SwapToken;
  children: ReactNode;
  className?: string;
};

/**
 * Helper component to easily open the swap modal from anywhere
 *
 * Usage:
 * ```tsx
 * <SwapButton
 *   targetToken={{
 *     address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     symbol: 'USDC',
 *     chainId: 1,
 *     decimals: 6
 *   }}
 * >
 *   <span className="text-primary cursor-pointer underline">Swap to USDC</span>
 * </SwapButton>
 * ```
 */
export function SwapButton({ targetToken, children, className }: SwapButtonProps) {
  const { openModal, closeModal } = useGlobalModal();

  const handleClick = () => {
    openModal(<BridgeSwapModal isOpen onClose={closeModal} targetToken={targetToken} />);
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
