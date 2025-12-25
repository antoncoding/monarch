import { useMemo, useState } from 'react';
import { ArrowDownIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { formatUnits, parseUnits } from 'viem';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/Input/Input';
import { useUserBalances } from '@/hooks/useUserBalances';
import { TokenIcon } from '@/components/shared/token-icon';
import { NetworkIcon } from '@/components/shared/network-icon';
import { getNetworkName } from '@/utils/networks';
import { useCowBridge } from '../hooks/useCowBridge';
import { TokenSelector } from './TokenSelector';
import { COW_BRIDGE_CHAINS, type SwapToken } from '../types';

type BridgeSwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetToken: SwapToken;
};

export function BridgeSwapModal({ isOpen, onClose, targetToken }: BridgeSwapModalProps) {
  const [sourceToken, setSourceToken] = useState<SwapToken | null>(null);
  const [amount, setAmount] = useState<bigint>(BigInt(0));
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5%
  const [amountError, setAmountError] = useState<string | null>(null);

  // Fetch user balances from CoW-supported chains
  const { balances, loading: balancesLoading } = useUserBalances({
    networkIds: COW_BRIDGE_CHAINS as unknown as number[],
  });

  // Convert balances to SwapTokens
  const availableTokens = useMemo<SwapToken[]>(() => {
    return balances
      .filter((b) => BigInt(b.balance) > BigInt(0)) // Only show tokens with balance
      .map((b) => ({
        address: b.address as `0x${string}`,
        symbol: b.symbol,
        chainId: b.chainId,
        decimals: b.decimals,
        balance: BigInt(b.balance),
      }))
      .sort((a, b) => {
        // Sort by balance (descending)
        const aValue = Number(formatUnits(a.balance ?? BigInt(0), a.decimals));
        const bValue = Number(formatUnits(b.balance ?? BigInt(0), b.decimals));
        return bValue - aValue;
      });
  }, [balances]);

  // CoW Bridge hook
  const {
    quote,
    isQuoting,
    isApproving,
    isExecuting,
    needsApproval,
    currentAllowance,
    error: swapError,
    orderUid,
    approveToken,
    executeSwap,
    reset,
  } = useCowBridge({
    sourceToken,
    targetToken,
    amount,
    slippageBps: Math.round(slippage * 100),
  });

  const handleSourceTokenSelect = (token: SwapToken) => {
    setSourceToken(token);
    setAmount(BigInt(0));
    setAmountError(null);
  };

  const handleMaxClick = () => {
    if (sourceToken?.balance) {
      setAmount(sourceToken.balance);
    }
  };

  const handleClose = () => {
    reset();
    setSourceToken(null);
    setAmount(BigInt(0));
    setAmountError(null);
    onClose();
  };

  const isLoading = isQuoting || isApproving || isExecuting;
  const canExecute = quote && !needsApproval && !isExecuting && amount > BigInt(0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} variant="standard" zIndex="base" size="xl">
      <ModalHeader title="Swap Tokens" description="Trade tokens across chains via CoW Protocol" />

      <ModalBody>
        <div className="space-y-4">
          {/* Source Token Selector */}
          <TokenSelector
            label="From"
            selectedToken={sourceToken}
            tokens={availableTokens}
            onSelect={handleSourceTokenSelect}
            disabled={balancesLoading}
          />

          {/* Amount Input */}
          {sourceToken && (
            <div>
              <div className="mb-1 text-xs text-secondary">Amount</div>
              <Input
                decimals={sourceToken.decimals}
                setValue={setAmount}
                value={amount}
                max={sourceToken.balance}
                setError={setAmountError}
                onMaxClick={handleMaxClick}
                error={amountError}
              />
              {amountError && <p className="mt-1 text-sm text-red-500">{amountError}</p>}
            </div>
          )}

          {/* Arrow Indicator */}
          {sourceToken && (
            <div className="flex justify-center">
              <ArrowDownIcon className="text-secondary h-5 w-5" />
            </div>
          )}

          {/* Target Token Display */}
          {sourceToken && (
            <div>
              <div className="mb-1 text-xs text-secondary">To</div>
              <div className="bg-hovered flex h-14 items-center gap-2 rounded-sm px-4">
                <TokenIcon
                  address={targetToken.address}
                  chainId={targetToken.chainId}
                  symbol={targetToken.symbol}
                  width={20}
                  height={20}
                />
                <span className="font-medium">{targetToken.symbol}</span>
                <div className="badge flex items-center gap-1">
                  <NetworkIcon networkId={targetToken.chainId} />
                  <span className="text-xs">{getNetworkName(targetToken.chainId)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quote Display */}
          {quote && sourceToken && (
            <div className="bg-surface space-y-2 rounded p-3">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">You receive</span>
                <span className="font-medium">
                  {Number(formatUnits(quote.buyAmount, targetToken.decimals)).toFixed(6)} {targetToken.symbol}
                </span>
              </div>

              {quote.type === 'cross-chain' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">Type</span>
                    <span className="font-medium">Cross-chain swap</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">Bridge</span>
                    <span className="font-medium">{quote.bridgeProvider}</span>
                  </div>
                  {quote.estimatedTimeSeconds && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary">Estimated time</span>
                      <span className="font-medium">{Math.ceil(quote.estimatedTimeSeconds / 60)} minutes</span>
                    </div>
                  )}
                  {quote.bridgeFee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary">Bridge fee</span>
                      <span className="font-medium">
                        {Number(formatUnits(quote.bridgeFee, sourceToken.decimals)).toFixed(6)}{' '}
                        {sourceToken.symbol}
                      </span>
                    </div>
                  )}
                </>
              )}

              {quote.type === 'same-chain' && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Type</span>
                  <span className="font-medium">Same-chain swap</span>
                </div>
              )}
            </div>
          )}

          {/* Slippage Setting */}
          {sourceToken && (
            <div className="flex items-center gap-2">
              <span className="text-secondary text-sm">Slippage tolerance:</span>
              <input
                type="number"
                value={slippage}
                min={0}
                max={10}
                step={0.1}
                onChange={(e) => setSlippage(Number(e.target.value))}
                className="bg-hovered w-16 rounded-sm p-1 text-sm focus:border-primary focus:outline-none"
              />
              <span className="text-secondary text-sm">%</span>
            </div>
          )}

          {/* Approval Warning */}
          {needsApproval && currentAllowance !== null && sourceToken && (
            <div className="rounded bg-yellow-50 p-3 text-sm dark:bg-yellow-900/20">
              <p className="font-medium">⚠️ Approval Required</p>
              <p className="text-secondary mt-1 text-xs">
                You need to approve CoW Protocol to spend your {sourceToken.symbol}
              </p>
              {currentAllowance > BigInt(0) && (
                <p className="text-secondary mt-1 text-xs">
                  Current allowance: {Number(formatUnits(currentAllowance, sourceToken.decimals)).toFixed(4)}{' '}
                  {sourceToken.symbol}
                </p>
              )}
            </div>
          )}

          {/* Success Message */}
          {orderUid && (
            <div className="rounded bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-sm font-medium">✓ Order Submitted Successfully!</p>
              <p className="text-secondary mt-1 break-all text-xs">{orderUid}</p>
              <a
                href={`https://explorer.cow.fi/orders/${orderUid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1 text-xs underline"
              >
                View in CoW Explorer
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Error Display */}
          {swapError && <div className="text-sm text-red-500">{swapError.message}</div>}

          {/* Empty State */}
          {!balancesLoading && availableTokens.length === 0 && (
            <div className="text-secondary py-8 text-center text-sm">
              <p>No tokens found on supported chains</p>
              <p className="mt-1 text-xs">Supported: Ethereum, Base, Polygon, Arbitrum</p>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          {orderUid ? 'Close' : 'Cancel'}
        </Button>
        {needsApproval && !orderUid && (
          <Button variant="primary" onClick={approveToken} disabled={isApproving || !sourceToken || amount === BigInt(0)}>
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        )}
        {!orderUid && (
          <Button variant="cta" onClick={executeSwap} disabled={!canExecute || isLoading}>
            {isExecuting ? 'Swapping...' : isQuoting ? 'Getting Quote...' : 'Swap'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
