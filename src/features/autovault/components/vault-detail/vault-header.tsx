'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, GearIcon } from '@radix-ui/react-icons';
import { IoEllipsisVertical } from 'react-icons/io5';
import { FiExternalLink } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TokenIcon } from '@/components/shared/token-icon';
import { AddressIdentity } from '@/components/shared/address-identity';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { getExplorerURL } from '@/utils/external';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import type { Address } from 'viem';

import { AgentIcon } from '@/components/shared/agent-icon';
import { findAgent } from '@/utils/monarch-agent';
import { CollateralIconsDisplay } from '@/features/positions/components/collateral-icons-display';
import { getSlicedAddress } from '@/utils/address';
import { formatVaultAdapterType } from '@/utils/vaults';

type VaultHeaderAdapterRow = {
  adapter: Address;
  adapterType?: string;
};

type VaultHeaderProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  title: string;
  symbol: string;
  assetAddress?: Address;
  assetSymbol?: string;
  totalAssetsLabel: string;
  apyLabel: string;
  userShareBalance?: string;
  allocators?: string[];
  sentinels?: string[];
  owner?: string;
  collaterals?: { address: string; symbol: string; amount: number }[];
  curator?: string;
  adapter?: string;
  adapters?: VaultHeaderAdapterRow[];
  capsAdapters?: VaultHeaderAdapterRow[];
  onDeposit: () => void;
  onWithdraw: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  showWithdrawWhenEmpty?: boolean;
  isRefetching: boolean;
  isLoading: boolean;
  morphoHref?: string;
};

export function VaultHeader({
  vaultAddress,
  chainId,
  title,
  symbol,
  assetAddress,
  assetSymbol,
  totalAssetsLabel,
  apyLabel,
  userShareBalance,
  allocators = [],
  sentinels = [],
  owner,
  collaterals = [],
  curator,
  adapter,
  adapters = [],
  capsAdapters = [],
  onDeposit,
  onWithdraw,
  onRefresh,
  onSettings,
  showWithdrawWhenEmpty = false,
  isRefetching,
  isLoading,
  morphoHref,
}: VaultHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toast = useStyledToast();
  const networkImg = getNetworkImg(chainId);

  const handleCopyVaultAddress = async () => {
    try {
      await navigator.clipboard.writeText(vaultAddress);
      toast.success('Vault address copied', `${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`);
    } catch {
      toast.error('Copy failed', 'Clipboard access is not available');
    }
  };

  // Filter for known agents
  const knownAllocators = allocators.filter((addr) => findAgent(addr) !== undefined);
  const adapterRows = adapters.length > 0 ? adapters : adapter ? [{ adapter: adapter as Address }] : [];
  const capsAdapterRows = capsAdapters.length > 0 ? capsAdapters : adapter ? [{ adapter: adapter as Address }] : [];
  const capsAdapterKeys = new Set(capsAdapterRows.map((row) => row.adapter.toLowerCase()));
  const showCapsAdapter = adapterRows.length > 1 && capsAdapterRows.length > 0;
  const capsAdapterLabel =
    capsAdapterRows.length === 1
      ? `${formatVaultAdapterType(capsAdapterRows[0].adapterType)} ${getSlicedAddress(capsAdapterRows[0].adapter)}`
      : `${capsAdapterRows.length} configured adapters`;

  return (
    <div className="mt-6 mb-6 space-y-4">
      {/* Main Header */}
      <div className="rounded border border-border bg-surface px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Vault Identity */}
          <div className="flex items-center gap-4">
            {/* Primary Token Icon */}
            {assetAddress && (
              <TokenIcon
                address={assetAddress}
                chainId={chainId}
                symbol={assetSymbol ?? ''}
                width={40}
                height={40}
              />
            )}

            <div>
              <div className="flex items-center gap-2 pt-1 text-2xl font-medium">
                {title}
                <span className="rounded bg-hovered px-2 py-0.5 text-xs text-secondary align-middle font-normal">{symbol}</span>
                <button
                  type="button"
                  onClick={handleCopyVaultAddress}
                  className="text-secondary transition-colors hover:text-primary ml-1"
                >
                  <LuCopy className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                {networkImg && (
                  <div className="flex items-center gap-1">
                    <Image
                      src={networkImg}
                      alt={'network'}
                      width={14}
                      height={14}
                    />
                    <span>{getNetworkName(chainId)}</span>
                  </div>
                )}
                {assetSymbol && (
                  <>
                    <span className="text-border">·</span>
                    <span>Asset: {assetSymbol}</span>
                  </>
                )}
                {curator && (
                  <>
                    <span className="text-border">·</span>
                    <span>Curator: {getSlicedAddress(curator as Address)}</span>
                  </>
                )}
                {showCapsAdapter && (
                  <>
                    <span className="text-border">·</span>
                    <span>Caps: {capsAdapterLabel}</span>
                  </>
                )}
                {knownAllocators.length > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <div className="flex items-center gap-1">
                      <span>Allocators:</span>
                      <div className="flex -space-x-2 ml-1">
                        {knownAllocators.slice(0, 3).map((addr, index) => (
                          <div
                            key={addr}
                            style={{ zIndex: 10 - index }}
                            className="relative"
                          >
                            <AgentIcon
                              address={addr as Address}
                              width={20}
                              height={20}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {collaterals.length > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <div className="flex items-center gap-1">
                      <span>Collaterals:</span>
                      <div className="flex ml-1">
                        <CollateralIconsDisplay
                          collaterals={collaterals}
                          chainId={chainId}
                          maxDisplay={5}
                          iconSize={16}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Stats + Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Key Stats */}
            <div className="flex items-center gap-6 border-r border-border pr-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">APY</p>
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <div className="h-6 w-16 animate-pulse rounded bg-hovered" />
                  ) : (
                    <p className="tabular-nums text-lg font-medium text-primary">{apyLabel}</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Total Assets</p>
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <div className="h-6 w-24 animate-pulse rounded bg-hovered" />
                  ) : (
                    <p className="tabular-nums text-lg font-medium">{totalAssetsLabel}</p>
                  )}
                </div>
              </div>
              {userShareBalance && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-secondary">My Balance</p>
                  <div className="flex items-center gap-2">
                    <p className="tabular-nums text-lg font-medium">{userShareBalance}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onDeposit}
                disabled={isLoading}
              >
                Deposit
              </Button>
              {(userShareBalance || showWithdrawWhenEmpty) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onWithdraw}
                  disabled={isLoading || !userShareBalance}
                >
                  Withdraw
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-secondary"
                  >
                    <IoEllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={onRefresh}
                    disabled={isRefetching}
                    startContent={<RefetchIcon isLoading={isRefetching} />}
                  >
                    Refresh Data
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onSettings}
                    startContent={<GearIcon className="h-4 w-4" />}
                  >
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.open(getExplorerURL(vaultAddress, chainId), '_blank', 'noopener,noreferrer')}
                    startContent={<FiExternalLink className="h-4 w-4" />}
                  >
                    View on Explorer
                  </DropdownMenuItem>
                  {morphoHref && (
                    <DropdownMenuItem
                      onClick={() => window.open(morphoHref, '_blank', 'noopener,noreferrer')}
                      startContent={<FiExternalLink className="h-4 w-4" />}
                    >
                      View on Morpho
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Advanced Details - Expandable */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between text-sm text-secondary hover:text-primary"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            <div className="flex items-center gap-2">
              <span>Vault Details</span>
            </div>
            <div className="flex items-center gap-2">
              <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs uppercase tracking-wider text-secondary">Configuration</h4>
                    </div>
                    {owner && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-secondary">Owner:</span>
                        <AddressIdentity
                          address={owner}
                          chainId={chainId}
                        />
                      </div>
                    )}
                    {curator && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-secondary">Curator:</span>
                        <AddressIdentity
                          address={curator}
                          chainId={chainId}
                        />
                      </div>
                    )}
                    {adapterRows.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-secondary">Adapters:</span>
                        <div className="flex flex-col gap-1.5">
                          {adapterRows.map((row) => (
                            <div
                              key={row.adapter}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <span className="text-xs text-secondary">{formatVaultAdapterType(row.adapterType)}:</span>
                              <AddressIdentity
                                address={row.adapter}
                                chainId={chainId}
                              />
                              {capsAdapterKeys.has(row.adapter.toLowerCase()) && (
                                <span className="rounded-sm bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-400/10 dark:text-green-300">
                                  Active
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {allocators.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs uppercase tracking-wider text-secondary">Allocators</h4>
                        <div className="flex flex-col gap-1.5">
                          {allocators.map((addr) => (
                            <div
                              key={addr}
                              className="flex items-center gap-1.5"
                            >
                              <AddressIdentity
                                address={addr}
                                chainId={chainId}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sentinels.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs uppercase tracking-wider text-secondary">Sentinels</h4>
                        <div className="flex flex-col gap-1.5">
                          {sentinels.map((addr) => (
                            <div
                              key={addr}
                              className="flex items-center gap-1.5"
                            >
                              <AddressIdentity
                                address={addr}
                                chainId={chainId}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
