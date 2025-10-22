import { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { LuVault } from 'react-icons/lu';
import { Address, formatUnits } from 'viem';
import { Spinner } from '@/components/common/Spinner';
import { useTokens } from '@/components/providers/TokenProvider';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { TokenBalance } from '@/hooks/useUserBalances';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { useDeployment, SelectedToken } from './DeploymentContext';

type TokenNetwork = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  img?: string;
  balance: bigint;
  networkId: number;
  marketCount: number;
  hasExistingVault: boolean;
};

function NetworkIcon({ networkId }: { networkId: number }) {
  const url = getNetworkImg(networkId);
  return (
    <Image
      src={url as string}
      alt={`networkId-${networkId}`}
      width={16}
      height={16}
      className="rounded-full"
    />
  );
}

type TokenSelectionProps = {
  balances: TokenBalance[] | null;
  balancesLoading: boolean;
  whitelistedMarkets: Market[] | null;
  marketsLoading: boolean;
  existingVaults: UserVaultV2[];
};

export function TokenSelection({ balances, balancesLoading, whitelistedMarkets, marketsLoading, existingVaults }: TokenSelectionProps) {
  const { selectedTokenAndNetwork, setSelectedTokenAndNetwork } = useDeployment();

  const { findToken } = useTokens();

  const availableTokenNetworks = useMemo(() => {
    if (!balances || !whitelistedMarkets) return [];

    // Use whitelisted markets only
    const marketsToUse = whitelistedMarkets;

    const tokenNetworks: TokenNetwork[] = [];

    balances.forEach((balance) => {
      const token = findToken(balance.address, balance.chainId);

      if (!token) return;

      const network = balance.chainId as SupportedNetworks;
      const balanceValue = balance.balance ? BigInt(balance.balance) : 0n;

      if (network && balanceValue > 0n) {
        const hasExistingVault = existingVaults.some(
          (vault) =>
            vault.networkId === balance.chainId &&
            vault.asset.toLowerCase() === balance.address.toLowerCase(),
        );

        // Count markets for this token on this network
        const marketCount = marketsToUse.filter(
          (market) =>
            market.loanAsset.address.toLowerCase() === balance.address.toLowerCase() &&
            market.morphoBlue.chain.id === balance.chainId
        ).length;

        if (marketCount === 0) return;

        tokenNetworks.push({
          symbol: token.symbol,
          name: token.symbol,
          address: balance.address as Address,
          decimals: token.decimals,
          img: token.img,
          balance: balanceValue,
          networkId: balance.chainId,
          marketCount,
          hasExistingVault,
        });
      }
    });

    // Sort by balance descending, then by symbol
    return tokenNetworks.sort((a, b) => {
      const aBalance = Number(formatUnits(a.balance, a.decimals));
      const bBalance = Number(formatUnits(b.balance, b.decimals));
      if (bBalance !== aBalance) return bBalance - aBalance;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [balances, existingVaults, findToken, whitelistedMarkets]);

  const handleTokenNetworkSelect = (tokenNetwork: TokenNetwork) => {
    const selectedToken: SelectedToken = {
      symbol: tokenNetwork.symbol,
      name: tokenNetwork.name,
      address: tokenNetwork.address,
      decimals: tokenNetwork.decimals,
    };

    setSelectedTokenAndNetwork({
      token: selectedToken,
      networkId: tokenNetwork.networkId,
    });
  };

  // Show loading state while fetching balances or markets
  if (balancesLoading || marketsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Spinner/>
          <p className="mt-3 text-sm text-secondary">
            {balancesLoading && marketsLoading
              ? 'Loading token balances and markets...'
              : balancesLoading
              ? 'Fetching your token balances across networks'
              : 'Loading available markets...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {availableTokenNetworks.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Tokens Found</h3>
          <p className="text-secondary max-w-sm mx-auto">
            Make sure you have some tokens in your wallet to create an autovault
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {availableTokenNetworks.map((tokenNetwork) => {
              const isSelected =
                selectedTokenAndNetwork?.token?.address?.toLowerCase?.() === tokenNetwork.address.toLowerCase() &&
                selectedTokenAndNetwork?.networkId === tokenNetwork.networkId;

              return (
                <div
                  key={`${tokenNetwork.symbol}-${tokenNetwork.networkId}-${tokenNetwork.address}`}
                  className={`relative cursor-pointer rounded-sm border p-3 pr-8 transition-colors duration-200 ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-hovered'
                  }`}
                  onClick={() => handleTokenNetworkSelect(tokenNetwork)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTokenNetworkSelect(tokenNetwork);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TokenIcon address={tokenNetwork.address} chainId={tokenNetwork.networkId} width={20} height={20}/>
                      <span className="font-medium">{formatReadable(formatUnits(tokenNetwork.balance, tokenNetwork.decimals))} {tokenNetwork.symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {tokenNetwork.hasExistingVault && (
                        <Tooltip
                          classNames={{
                            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
                          }}
                          content={
                            <TooltipContent
                              icon={<LuVault className="h-4 w-4 text-primary" />}
                              title="Vault deployed"
                              detail={`You already deployed this token on ${getNetworkName(tokenNetwork.networkId)}.`}
                            />
                          }
                        >
                          <span className="text-secondary">
                            <LuVault className="h-4 w-4" />
                          </span>
                        </Tooltip>
                      )}

                      <NetworkIcon networkId={tokenNetwork.networkId} />
                      <span className="text-sm text-secondary">
                        {tokenNetwork.marketCount} market{tokenNetwork.marketCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
