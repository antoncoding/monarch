import Image from 'next/image';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { useTokens } from '@/components/providers/TokenProvider';
import { TokenIcon } from '@/components/TokenIcon';
import { UserVaultV2 } from '@/data-sources/subgraph/v2-vaults';
import { formatReadable } from '@/utils/balance';
import { SupportedNetworks, getNetworkImg } from '@/utils/networks';

type VaultListV2Props = {
  vaults: UserVaultV2[];
  loading: boolean;
};

export function VaultListV2({ vaults, loading }: VaultListV2Props) {
  const { findToken } = useTokens();

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
        <p className="text-secondary max-w-sm mx-auto">
          You haven't deployed any autovaults yet. Create your first one to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h2 className="text-lg font-semibold">Your Vaults</h2>

      <div className="w-full overflow-x-auto">
        <table className="responsive w-full rounded font-zen">
          <thead className="table-header">
            <tr>
              <th className="font-normal">ID</th>
              <th className="font-normal">Asset</th>
              <th className="font-normal">APY</th>
              <th className="font-normal">Agents</th>
              <th className="font-normal">Collaterals</th>
              <th className="font-normal">Action</th>
            </tr>
          </thead>
          <tbody className="table-body text-sm">
            {vaults.map((vault) => {
              const token = findToken(vault.asset, vault.networkId);
              const networkImg = getNetworkImg(vault.networkId);

              return (
                <tr key={vault.id}>
                  {/* ID */}
                  <td data-label="ID">
                    <div className="flex items-center justify-center gap-1 font-monospace text-xs">
                      {networkImg && <Image src={networkImg} alt="icon" width={15} height={15} />}
                      <span>{vault.newVaultV2.slice(2, 8)}</span>
                    </div>
                  </td>

                  {/* Asset */}
                  <td data-label="Asset">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium">
                        {vault.balance && token ?
                          formatReadable(formatUnits(BigInt(vault.balance), token.decimals))
                          : '0'}
                      </span>
                      <span>{token?.symbol ?? 'USDC'}</span>
                      <TokenIcon
                        address={vault.asset}
                        chainId={vault.networkId}
                        width={16}
                        height={16}
                      />
                    </div>
                  </td>

                  {/* APY */}
                  <td data-label="APY">
                    <span className="font-zen text-sm">--</span>
                  </td>

                  {/* Agents */}
                  <td data-label="Agents">
                    <span className="font-zen text-sm">--</span>
                  </td>

                  {/* Collaterals */}
                  <td data-label="Collaterals">
                    <span className="font-zen text-sm">--</span>
                  </td>

                  {/* Action */}
                  <td data-label="Action">
                    <div className="flex justify-center">
                      <Link href={`/autovault/${vault.networkId ?? SupportedNetworks.Base}/${vault.newVaultV2}`}>
                        <Button variant="interactive" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
