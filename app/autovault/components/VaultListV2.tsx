import Image from 'next/image';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/common/Spinner';
import { useTokens } from '@/components/providers/TokenProvider';
import { TokenIcon } from '@/components/TokenIcon';
import type { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { useMarkets } from '@/hooks/useMarkets';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable } from '@/utils/balance';
import { parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks, getNetworkImg } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';

type VaultListV2Props = {
  vaults: UserVaultV2[];
  loading: boolean;
};

export function VaultListV2({ vaults, loading }: VaultListV2Props) {
  const { findToken } = useTokens();
  const { isAprDisplay } = useMarkets();
  const { short: rateLabel } = useRateLabel();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Spinner />
          <p className="mt-3 text-sm text-secondary">Loading your vaults...</p>
        </div>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <span className="text-2xl">🏛️</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Vaults Found</h3>
        <p className="text-secondary max-w-sm mx-auto">You haven't deployed any autovaults yet. Create your first one to get started!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h2 className="text-lg">Your Vaults</h2>

      <div className="w-full overflow-x-auto">
        <Table className="responsive w-full rounded font-zen">
          <TableHeader className="">
            <TableRow>
              <TableHead className="font-normal">ID</TableHead>
              <TableHead className="font-normal">Asset</TableHead>
              <TableHead className="font-normal">{rateLabel}</TableHead>
              <TableHead className="font-normal">Collaterals</TableHead>
              <TableHead className="font-normal">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {vaults.map((vault) => {
              const token = findToken(vault.asset, vault.networkId);
              const networkImg = getNetworkImg(vault.networkId);

              const collaterals = vault.caps
                .map((cap) => parseCapIdParams(cap.idParams).collateralToken)
                .filter((collat) => collat !== undefined);

              return (
                <TableRow key={vault.address}>
                  {/* ID */}
                  <TableCell data-label="ID">
                    <div className="flex items-center justify-center gap-1 font-monospace text-xs">
                      {networkImg && (
                        <Image
                          src={networkImg}
                          alt="icon"
                          width={15}
                          height={15}
                        />
                      )}
                      <span>{vault.address.slice(2, 8)}</span>
                    </div>
                  </TableCell>

                  {/* Asset */}
                  <TableCell data-label="Asset">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium">
                        {vault.balance && token ? formatReadable(formatUnits(BigInt(vault.balance), token.decimals)) : '0'}
                      </span>
                      <span>{token?.symbol ?? 'USDC'}</span>
                      <TokenIcon
                        address={vault.asset}
                        chainId={vault.networkId}
                        width={16}
                        height={16}
                      />
                    </div>
                  </TableCell>

                  {/* APY/APR */}
                  <TableCell data-label={rateLabel}>
                    <span className="font-zen text-sm">
                      {vault.avgApy != null ? `${((isAprDisplay ? convertApyToApr(vault.avgApy) : vault.avgApy) * 100).toFixed(2)}%` : '—'}
                    </span>
                  </TableCell>

                  {/* Collaterals */}
                  <TableCell data-label="Collaterals">
                    <span className="flex flex-wrap gap-1.5 justify-center">
                      {collaterals.map((tokenAddress) => (
                        <div
                          key={tokenAddress}
                          className="flex items-center"
                        >
                          <TokenIcon
                            address={tokenAddress}
                            chainId={vault.networkId}
                            width={20}
                            height={20}
                          />
                        </div>
                      ))}
                    </span>
                  </TableCell>

                  {/* Action */}
                  <TableCell data-label="Action">
                    <div className="flex justify-center">
                      <Link href={`/autovault/${vault.networkId ?? SupportedNetworks.Base}/${vault.address}`}>
                        <Button
                          variant="surface"
                          size="sm"
                        >
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
