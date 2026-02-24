import Image from 'next/image';
import { getNetworkImg } from '@/utils/networks';

type NetworkIconProps = {
  networkId: number;
  size?: number;
};

export function NetworkIcon({ networkId, size = 16 }: NetworkIconProps) {
  const url = getNetworkImg(networkId);
  return (
    <Image
      src={url as string}
      alt={`networkId-${networkId}`}
      width={size}
      height={size}
      className="rounded-full"
    />
  );
}
