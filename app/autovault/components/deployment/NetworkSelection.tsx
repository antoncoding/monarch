import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/common/Button';
import { useTokens } from '@/components/providers/TokenProvider';
import { TokenIcon } from '@/components/TokenIcon';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import { useDeployment } from './DeploymentContext';

const SUPPORTED_NETWORKS: SupportedNetworks[] = [
  SupportedNetworks.Mainnet,
  SupportedNetworks.Base,
  SupportedNetworks.Arbitrum,
  SupportedNetworks.Polygon,
];

function NetworkCard({
  network,
  isSelected,
  isAvailable,
  onClick,
}: {
  network: SupportedNetworks;
  isSelected: boolean;
  isAvailable: boolean;
  onClick: () => void;
}) {
  const networkImg = getNetworkImg(network);
  const networkName = getNetworkName(network);

  return (
    <motion.div
      whileHover={isAvailable ? { scale: 1.01 } : {}}
      whileTap={isAvailable ? { scale: 0.99 } : {}}
      transition={{ duration: 0.1 }}
    >
      <div
        className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 ${
          !isAvailable
            ? 'cursor-not-allowed opacity-40 border-gray-200 dark:border-gray-700'
            : isSelected
            ? 'border-primary bg-primary/5 shadow-lg'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
        }`}
        onClick={isAvailable ? onClick : undefined}
        onKeyDown={(e) => {
          if (isAvailable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={isAvailable ? 0 : -1}
      >
        {isSelected && (
          <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative">
            <Image
              src={networkImg as string}
              alt={networkName}
              width={40}
              height={40}
              className="rounded-full"
            />
            {!isAvailable && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-lg mb-1">{networkName}</h4>
            <p className="text-sm text-secondary">
              {isAvailable ? 'Available for deployment' : 'Token not supported'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NetworkSelection() {
  const { allTokens } = useTokens();
  const { selectedToken, selectedNetwork, setSelectedNetwork, goToNextStep, goToPrevStep } =
    useDeployment();

  if (!selectedToken) {
    return (
      <div className="text-center">
        <p className="text-secondary">No token selected</p>
      </div>
    );
  }

  // Find which networks support the selected token
  const tokenInfo = allTokens.find((t) => t.symbol === selectedToken.symbol);
  const availableNetworks =
    tokenInfo?.networks
      .map((n) => Number(n.chain.id))
      .filter((id): id is SupportedNetworks =>
        Object.values(SupportedNetworks).includes(id as SupportedNetworks),
      ) || [];

  const handleNetworkSelect = (network: SupportedNetworks) => {
    setSelectedNetwork(network);
  };

  const handleNext = () => {
    if (selectedNetwork) {
      goToNextStep();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-3">Choose Network</h3>
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800">
          <TokenIcon token={selectedToken} size={24} />
          <span className="font-medium">{selectedToken.symbol}</span>
          <span className="text-secondary">→</span>
          <span className="text-secondary text-sm">Deployment Network</span>
        </div>
      </div>

      <div className="grid gap-3">
        {SUPPORTED_NETWORKS.map((network) => {
          const isAvailable = availableNetworks.includes(network);
          const isSelected = selectedNetwork === network;

          return (
            <NetworkCard
              key={network}
              network={network}
              isSelected={isSelected}
              isAvailable={isAvailable}
              onClick={() => handleNetworkSelect(network)}
            />
          );
        })}
      </div>

      <div className="flex justify-between gap-3 pt-4">
        <Button variant="light" onPress={goToPrevStep}>
          ← Back
        </Button>
        <Button variant="cta" onPress={handleNext} isDisabled={!selectedNetwork}>
          Continue →
        </Button>
      </div>
    </div>
  );
}
