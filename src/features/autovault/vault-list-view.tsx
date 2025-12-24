'use client';

import { useState, useEffect } from 'react';
import { FaPlus } from 'react-icons/fa';
import { FiShield, FiZap, FiSettings } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAppKit } from '@reown/appkit/react';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { fetchUserVaultV2AddressesAllNetworks } from '@/data-sources/subgraph/v2-vaults';
import { DeploymentModal } from './components/deployment/deployment-modal';

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
            className="bg-surface space-y-3 rounded shadow-sm p-6"
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

// Benefit card component
function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-surface space-y-3 rounded shadow-sm p-6 transition-all hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h3 className="font-zen text-lg text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-secondary">{description}</p>
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

  const handleManageVault = () => {
    if (vaultAddresses.length > 0) {
      const firstVault = vaultAddresses[0];
      router.push(`/autovault/${firstVault.networkId}/${firstVault.address}`);
    }
  };

  const hasVaults = vaultAddresses.length > 0;

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[4%] pb-20">
        {/* Loading State */}
        {hasMounted && isConnected && vaultsLoading && <PageSkeleton />}

        {/* Error Banner */}
        {fetchError && (
          <div className="mx-auto max-w-3xl rounded border border-red-500/40 bg-red-500/10 p-4 flex items-center justify-between">
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
          <div className="space-y-12 pt-8">
            {/* Hero Section */}
            <div className="mx-auto max-w-3xl space-y-4 text-center">
              <h1 className="font-zen text-3xl text-primary md:text-4xl">Be Your Own Risk Curator</h1>
              <p className="mx-auto max-w-2xl text-lg text-secondary">
                Deploy your own vault, define your risk parameters, and keep full control. No middlemen, no performance fees.
              </p>

              {/* Actions for users with existing vaults */}
              {isConnected && hasVaults && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="primary"
                    size="lg"
                    className="font-zen px-8"
                    onClick={handleManageVault}
                  >
                    Manage Vault
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    className="font-zen px-8"
                    onClick={handleCreateVault}
                  >
                    <FaPlus
                      size={16}
                      className="mr-2"
                    />
                    Deploy New
                  </Button>
                </div>
              )}

              {/* Primary CTA - changes based on connection status and vault ownership */}
              {(!isConnected || !hasVaults) && (
                <div className="flex items-center justify-center pt-4">
                  {isConnected ? (
                    <Button
                      variant="primary"
                      size="lg"
                      className="font-zen px-8"
                      onClick={handleCreateVault}
                    >
                      <FaPlus
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
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
              <BenefitCard
                icon={<FiShield className="h-5 w-5" />}
                title="Full Ownership"
                description="Your vault, your rules. No middlemen, no performance fees. Complete control over your assets and strategy."
              />
              <BenefitCard
                icon={<FiZap className="h-5 w-5" />}
                title="Smart Automation"
                description="Set your strategy once. Let agents optimize yields within your defined boundaries automatically."
              />
              <BenefitCard
                icon={<FiSettings className="h-5 w-5" />}
                title="Maximum Control"
                description="Choose your markets, set allocation caps, and stay in full command of your risk parameters."
              />
            </div>
          </div>
        )}

        {/* Deployment Modal */}
        <DeploymentModal
          isOpen={showDeploymentModal}
          onOpenChange={setShowDeploymentModal}
        />
      </div>
    </div>
  );
}
