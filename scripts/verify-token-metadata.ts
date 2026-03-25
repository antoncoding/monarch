import { createRequire } from 'node:module';
import type { SupportedNetworks as SupportedNetworkId } from '../src/utils/networks';

const moduleRequire = createRequire(import.meta.url);
const { loadEnvConfig } = moduleRequire('@next/env') as {
  loadEnvConfig: (dir: string) => void;
};

loadEnvConfig(process.cwd());

const assetExtensionLoader: NodeJS.RequireExtensions[string] = (module, filename) => {
  module.exports = filename;
};

for (const extension of ['.png', '.svg', '.webp']) {
  moduleRequire.extensions[extension] = assetExtensionLoader;
}

const { supportedTokens, infoToKey, MORPHO_LEGACY } = moduleRequire('../src/utils/tokens') as typeof import('../src/utils/tokens');
const { SupportedNetworks, getDefaultRPC, getNetworkName } = moduleRequire(
  '../src/utils/networks',
) as typeof import('../src/utils/networks');
const { fetchOnchainTokenMetadataMap } = moduleRequire('../src/utils/tokenMetadata') as typeof import('../src/utils/tokenMetadata');

type VerificationEntry = {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
};

type VerificationIssue = {
  kind: 'decimals-mismatch' | 'missing-decimals' | 'missing-symbol' | 'symbol-mismatch';
  entry: VerificationEntry;
  onchainDecimals?: number;
  onchainSymbol?: string;
  expectedOnchainSymbol?: string;
};

type ChainIssue = {
  chainId: number;
  message: string;
};

const expectedOnchainSymbolByKey = new Map<string, string>([
  [infoToKey('0x35d8949372d46b7a3d5a56006ae77b215fc69bc0', SupportedNetworks.Mainnet), 'bUSD0'],
  [infoToKey('0x00000000efe302beaa2b3e6e1b18d08d69a9012a', SupportedNetworks.Mainnet), 'AUSD'],
  [infoToKey('0x00000000efe302beaa2b3e6e1b18d08d69a9012a', SupportedNetworks.Monad), 'AUSD'],
  [infoToKey('0x8236a87084f8b84306f72007f36f2618a5634494', SupportedNetworks.Mainnet), 'LBTC'],
  [infoToKey('0xecac9c5f704e954931349da37f60e39f515c11c1', SupportedNetworks.Base), 'LBTC'],
  [infoToKey('0x00b174d66ada7d63789087f50a9b9e0e48446dc1', SupportedNetworks.Base), 'sPINTO'],
  [infoToKey('0xb0505e5a99abd03d94a1169e638b78edfed26ea4', SupportedNetworks.Base), 'uSUI'],
  [infoToKey('0xc2132d05d31c914a87c6611c10748aeb04b58e8f', SupportedNetworks.Polygon), 'USDT0'],
  [infoToKey('0xe7cd86e13ac4309349f30b3435a9d337750fc82d', SupportedNetworks.Monad), 'USDT0'],
  [infoToKey(MORPHO_LEGACY, SupportedNetworks.Mainnet), 'MORPHO'],
]);

const getVerificationEntries = (): VerificationEntry[] => {
  return supportedTokens.flatMap((token) =>
    token.networks.map((network) => ({
      address: network.address.toLowerCase(),
      chainId: network.chain.id,
      symbol: token.symbol,
      decimals: token.decimals,
    })),
  );
};

const formatIssue = (issue: VerificationIssue): string => {
  const { address, symbol, decimals } = issue.entry;

  switch (issue.kind) {
    case 'missing-decimals':
      return `${symbol} (${address}): decimals() could not be read on-chain. Configured decimals=${decimals}.`;
    case 'decimals-mismatch':
      return `${symbol} (${address}): configured decimals=${decimals}, on-chain decimals=${issue.onchainDecimals}.`;
    case 'missing-symbol':
      return `${symbol} (${address}): symbol() could not be read on-chain. Configured symbol="${symbol}".`;
    case 'symbol-mismatch':
      return `${symbol} (${address}): configured symbol="${symbol}", expected on-chain symbol="${issue.expectedOnchainSymbol}", actual on-chain symbol="${issue.onchainSymbol}".`;
    default: {
      const unexpectedKind: never = issue.kind;
      throw new Error(`Unknown verification issue kind: ${unexpectedKind}`);
    }
  }
};

const main = async () => {
  const verificationEntries = getVerificationEntries();
  const chainConfigIssues: ChainIssue[] = [];
  const entriesToVerify = verificationEntries.filter((entry) => {
    const rpcUrl = getDefaultRPC(entry.chainId as SupportedNetworkId);
    if (rpcUrl) {
      return true;
    }

    if (!chainConfigIssues.some((issue) => issue.chainId === entry.chainId)) {
      chainConfigIssues.push({
        chainId: entry.chainId,
        message: 'RPC is not configured for this network, so on-chain token metadata could not be verified.',
      });
    }

    return false;
  });

  const metadataByToken = await fetchOnchainTokenMetadataMap(
    entriesToVerify.map((entry) => ({
      address: entry.address,
      chainId: entry.chainId as SupportedNetworkId,
    })),
  );

  const issues: VerificationIssue[] = [];

  for (const entry of entriesToVerify) {
    const key = infoToKey(entry.address, entry.chainId);
    const metadata = metadataByToken.get(key);

    if (metadata?.decimals === undefined) {
      issues.push({
        kind: 'missing-decimals',
        entry,
      });
    } else if (metadata.decimals !== entry.decimals) {
      issues.push({
        kind: 'decimals-mismatch',
        entry,
        onchainDecimals: metadata.decimals,
      });
    }

    if (!metadata?.symbol) {
      issues.push({
        kind: 'missing-symbol',
        entry,
      });
      continue;
    }

    const expectedOnchainSymbol = expectedOnchainSymbolByKey.get(key) ?? entry.symbol;
    if (metadata.symbol !== expectedOnchainSymbol) {
      issues.push({
        kind: 'symbol-mismatch',
        entry,
        onchainSymbol: metadata.symbol,
        expectedOnchainSymbol,
      });
    }
  }

  if (issues.length === 0 && chainConfigIssues.length === 0) {
    const networkCount = new Set(verificationEntries.map((entry) => entry.chainId)).size;
    console.log(`Verified ${verificationEntries.length} token entries across ${networkCount} networks.`);
    return;
  }

  const issuesByChain = new Map<number, VerificationIssue[]>();
  for (const issue of issues) {
    const issuesForChain = issuesByChain.get(issue.entry.chainId) ?? [];
    issuesForChain.push(issue);
    issuesByChain.set(issue.entry.chainId, issuesForChain);
  }

  console.error(`Token metadata verification failed with ${issues.length + chainConfigIssues.length} issue(s).`);

  for (const [chainId, issuesForChain] of Array.from(issuesByChain.entries()).sort((left, right) => left[0] - right[0])) {
    console.error(`\n[${getNetworkName(chainId) ?? chainId}]`);
    for (const issue of issuesForChain) {
      console.error(`- ${formatIssue(issue)}`);
    }
  }

  for (const chainIssue of chainConfigIssues.sort((left, right) => left.chainId - right.chainId)) {
    console.error(`\n[${getNetworkName(chainIssue.chainId) ?? chainIssue.chainId}]`);
    console.error(`- ${chainIssue.message}`);
  }

  process.exitCode = 1;
};

main().catch((error: unknown) => {
  console.error('Token metadata verification failed with an unexpected error.');
  console.error(error);
  process.exitCode = 1;
});
