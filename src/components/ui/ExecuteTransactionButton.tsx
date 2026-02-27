import { useCallback, useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { useConnection } from 'wagmi';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { getNetworkName } from '@/utils/networks';

/**
 * UI delay after chain switch to allow wagmi state to update
 * Prevents button flicker during network transition
 */
const CHAIN_SWITCH_UI_DELAY_MS = 500;

type ExecuteTransactionButtonProps = Omit<ButtonProps, 'onClick' | 'children'> & {
  targetChainId: number;

  /**
   * The transaction execution function to call when ready
   */
  onClick: () => void;

  isLoading?: boolean;

  /**
   * The text to display when the button is ready to execute the transaction
   */
  children: React.ReactNode;

  /**
   * Optional custom text for the connect wallet state
   * @default "Connect Wallet"
   */
  connectText?: string;

  /**
   * Optional custom text for the switch chain state
   */
  switchChainText?: string;

  /**
   * Skip chain validation entirely. Use when the form is incomplete
   * @default false
   */
  skipChainCheck?: boolean;
};

/**
 * A smart transaction button that handles the complete flow:
 * 1. Connect wallet if not connected
 * 2. Switch to correct chain if needed
 * 3. Execute the transaction
 *
 * This eliminates the need for repetitive wallet connection and chain switching
 * checks across transaction components.
 *
 * @example
 * ```tsx
 * <ExecuteTransactionButton
 *   targetChainId={market.morphoBlue.chain.id}
 *   onClick={() => void approveAndSupply()}
 *   isLoading={supplyPending}
 *   disabled={!supplyAmount || inputError !== null}
 *   variant="primary"
 * >
 *   Supply
 * </ExecuteTransactionButton>
 * ```
 */
export function ExecuteTransactionButton({
  targetChainId,
  onClick,
  isLoading = false,
  children,
  connectText = 'Connect Wallet',
  switchChainText,
  skipChainCheck = false,
  disabled,
  variant = 'primary',
  ...buttonProps
}: ExecuteTransactionButtonProps): JSX.Element {
  const { open } = useAppKit();
  const { isConnected } = useConnection();
  const [isSwitching, setIsSwitching] = useState(false);

  // Use the market network hook for chain validation and switching
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId,
  });

  // Handle wallet connection
  const handleConnect = useCallback(() => {
    open();
  }, [open]);

  // Handle chain switching with loading state
  const handleSwitchChain = useCallback(async () => {
    setIsSwitching(true);
    try {
      switchToNetwork();
      // Wait for wagmi state to update after chain switch
      await new Promise((resolve) => setTimeout(resolve, CHAIN_SWITCH_UI_DELAY_MS));
    } finally {
      setIsSwitching(false);
    }
  }, [switchToNetwork]);

  // Determine button state and content
  if (!isConnected) {
    return (
      <Button
        // no disabled cuz always allow connect
        onClick={handleConnect}
        variant={variant}
        {...buttonProps}
      >
        {connectText}
      </Button>
    );
  }

  if (needSwitchChain && !skipChainCheck) {
    const defaultSwitchText = `Switch to ${getNetworkName(targetChainId)}`;
    return (
      <Button
        onClick={() => void handleSwitchChain()}
        variant={variant}
        // always allow clicking switch chain unless it's switching
        disabled={isSwitching}
        isLoading={isSwitching}
        {...buttonProps}
      >
        {switchChainText ?? defaultSwitchText}
      </Button>
    );
  }

  // Ready to execute transaction
  return (
    <Button
      onClick={onClick}
      variant={variant}
      disabled={disabled || isLoading}
      isLoading={isLoading}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
