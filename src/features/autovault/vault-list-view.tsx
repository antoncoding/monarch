'use client';

import { useState, useEffect, useMemo } from 'react';
import { GoPlusCircle } from 'react-icons/go';
import { FiShield, FiZap } from 'react-icons/fi';
import { GearIcon } from '@radix-ui/react-icons';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { useAppKit } from '@reown/appkit/react';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/Avatar/Avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import Header from '@/components/layout/header/Header';
import { fetchUserVaultV2AddressesAllNetworks } from '@/data-sources/subgraph/v2-vaults';
import { getDeployedVaults } from '@/utils/vault-storage';
import { DeploymentModal } from './components/deployment/deployment-modal';
import { SectionTag, FeatureCard } from '@/components/landing';

// Skeleton component for loading state
function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-12">
      {/* Hero skeleton */}
      <div className="space-y-4 text-center">
        <div className="bg-hovered mx-auto h-8 w-64 rounded" />
        <div className="bg-hovered mx-auto h-6 w-96 rounded" />
        <div className="bg-hovered mx-auto mt-6 h-12 w-48 rounded" />
      </div>

      {/* Benefits skeleton */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface space-y-3 rounded p-6"
          >
            <div className="bg-hovered h-10 w-10 rounded-full" />
            <div className="bg-hovered h-6 w-32 rounded" />
            <div className="bg-hovered h-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AutovaultListContent() {
  const router = useRouter();
  const { open } = useAppKit();
  const { isConnected, address } = useConnection();
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [vaultAddresses, setVaultAddresses] = useState<{ address: string; networkId: number }[]>([]);
  const [vaultsLoading, setVaultsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch vault addresses from subgraph (simple, fast, works for uninitialized vaults)
  useEffect(() => {
    if (!address || !isConnected) {
      setVaultAddresses([]);
      setFetchError(null);
      return;
    }

    const fetchVaults = async () => {
      setVaultsLoading(true);
      setFetchError(null);
      try {
        const addresses = await fetchUserVaultV2AddressesAllNetworks(address);
        setVaultAddresses(addresses);
      } catch (_error) {
        setFetchError('Unable to load vaults. Please try again.');
        // Keep existing vault addresses if we had them (don't clear on error)
      } finally {
        setVaultsLoading(false);
      }
    };

    void fetchVaults();
  }, [address, isConnected]);

  const handleRetryFetch = () => {
    if (address && isConnected) {
      setVaultsLoading(true);
      setFetchError(null);
      fetchUserVaultV2AddressesAllNetworks(address)
        .then((addresses) => setVaultAddresses(addresses))
        .catch(() => setFetchError('Unable to load vaults. Please try again.'))
        .finally(() => setVaultsLoading(false));
    }
  };

  const handleConnect = () => {
    open();
  };

  const handleCreateVault = () => {
    setShowDeploymentModal(true);
  };

  // Merge locally stored vaults with API results (filtered by connected address)
  const mergedVaultAddresses = useMemo(() => {
    const apiVaults = vaultAddresses;
    // Only get locally stored vaults for the currently connected address
    const localVaults = address ? getDeployedVaults(address) : [];

    // Create a map of existing vaults by address+chainId for quick lookup
    const existingVaults = new Set(apiVaults.map((v) => `${v.address.toLowerCase()}-${v.networkId}`));

    // Add local vaults that aren't in API results yet
    const combined = [...apiVaults];
    for (const localVault of localVaults) {
      const key = `${localVault.address.toLowerCase()}-${localVault.chainId}`;
      if (!existingVaults.has(key)) {
        combined.push({
          address: localVault.address,
          networkId: localVault.chainId,
        });
      }
    }

    return combined;
  }, [vaultAddresses, address]);

  const handleManageVault = (vaultAddress?: string, networkId?: number) => {
    if (vaultAddress && networkId) {
      router.push(`/autovault/${networkId}/${vaultAddress}`);
    } else if (mergedVaultAddresses.length > 0) {
      const firstVault = mergedVaultAddresses[0];
      router.push(`/autovault/${firstVault.networkId}/${firstVault.address}`);
    }
  };

  const hasVaults = mergedVaultAddresses.length > 0;
  const hasSingleVault = mergedVaultAddresses.length === 1;
  const hasMultipleVaults = mergedVaultAddresses.length > 1;

  return (
    <div className="bg-main min-h-screen font-zen relative flex flex-col">
      {/* Subtle dot grid background */}
      <div
        className="fixed inset-0 bg-dot-grid pointer-events-none opacity-40"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <Header />

      <main className="relative z-10 container mx-auto py-12">
        {/* Loading State */}
        {hasMounted && isConnected && vaultsLoading && <PageSkeleton />}

        {/* Error Banner */}
        {fetchError && (
          <div className="mx-auto max-w-3xl rounded border border-red-500/40 bg-red-500/10 p-4 flex items-center justify-between mb-8">
            <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
            <Button
              variant="default"
              size="sm"
              onClick={handleRetryFetch}
              disabled={vaultsLoading}
            >
              {vaultsLoading ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        )}

        {/* Content - shown to all users (connected or not, after loading) */}
        {hasMounted && (!isConnected || !vaultsLoading) && (
          <div className="space-y-20">
            {/* Hero Section */}
            <div className="mx-auto max-w-3xl space-y-4 text-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <SectionTag>AutoVault</SectionTag>
              </div>
              <h1 className="font-zen text-3xl text-primary sm:text-4xl md:text-5xl mb-3">Be Your Own Risk Curator</h1>
              <p className="mx-auto max-w-2xl text-lg text-secondary sm:text-xl">
                Deploy your own vault, define your risk parameters, and keep full control.
              </p>

              {/* Actions for users with existing vaults */}
              {isConnected && hasVaults && (
                <div className="flex items-center justify-center gap-3 pt-6">
                  {/* Single vault - show avatar with address */}
                  {hasSingleVault && (
                    <Button
                      variant="primary"
                      size="lg"
                      className="font-zen px-6"
                      onClick={() => handleManageVault()}
                    >
                      <Avatar
                        address={mergedVaultAddresses[0].address as `0x${string}`}
                        size={20}
                      />
                      <span className="ml-2">Manage {mergedVaultAddresses[0].address.slice(0, 6)}</span>
                    </Button>
                  )}

                  {/* Multiple vaults - show dropdown */}
                  {hasMultipleVaults && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="primary"
                          size="lg"
                          className="font-zen px-6"
                        >
                          <Avatar
                            address={mergedVaultAddresses[0].address as `0x${string}`}
                            size={20}
                          />
                          <span className="ml-2">Manage {mergedVaultAddresses[0].address.slice(0, 6)}</span>
                          <ChevronDownIcon className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        {mergedVaultAddresses.map((vault) => (
                          <DropdownMenuItem
                            key={`${vault.networkId}-${vault.address}`}
                            onClick={() => handleManageVault(vault.address, vault.networkId)}
                            className="cursor-pointer"
                            startContent={<Avatar address={vault.address as `0x${string}`} size={16} />}
                          >
                            {vault.address.slice(0, 6)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <Button
                    variant="default"
                    size="lg"
                    className="font-zen px-8"
                    onClick={handleCreateVault}
                  >
                    <GoPlusCircle
                      size={16}
                      className="mr-2"
                    />
                    Deploy New
                  </Button>
                </div>
              )}

              {/* Primary CTA - changes based on connection status and vault ownership */}
              {(!isConnected || !hasVaults) && (
                <div className="flex items-center justify-center pt-6">
                  {isConnected ? (
                    <Button
                      variant="primary"
                      size="lg"
                      className="font-zen px-8"
                      onClick={handleCreateVault}
                    >
                      <GoPlusCircle
                        size={16}
                        className="mr-2"
                      />
                      Deploy Autovault
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      className="font-zen px-8"
                      onClick={handleConnect}
                    >
                      Connect Wallet
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Benefits Section */}
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
              <FeatureCard
                icon={<GearIcon className="h-6 w-6" />}
                title="Full Ownership"
                description="Your vault, your rules. No middlemen, no hidden fees. Complete control over your assets."
              />
              <FeatureCard
                icon={<FiZap className="h-6 w-6" />}
                title="Smart Automation"
                description="Set your strategy once. Let agents optimize yields within your defined boundaries."
              />
              <FeatureCard
                icon={<FiShield className="h-6 w-6" />}
                title="Top Level Security"
                description="Built on Morpho V2 vault infrastructure, audited by Spearbit, Cantina, Blackthorn and more."
              />
            </div>
          </div>
        )}

        {/* Deployment Modal */}
        <DeploymentModal
          isOpen={showDeploymentModal}
          onOpenChange={setShowDeploymentModal}
        />
      </main>
    </div>
  );
}
