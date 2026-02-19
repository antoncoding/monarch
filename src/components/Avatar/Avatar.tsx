import Image from 'next/image';
import type { Address } from 'viem';

type AvatarProps = {
  address: Address;
  size?: number;
  rounded?: boolean;
};

export function Avatar({ address, size = 30, rounded = true }: AvatarProps) {
  const dicebearUrl = `https://api.dicebear.com/7.x/pixel-art/png?seed=${address}`;

  return (
    <div style={{ width: size, height: size }}>
      <Image
        src={dicebearUrl}
        alt={`Avatar for ${address}`}
        width={size}
        height={size}
        style={{ borderRadius: rounded ? '50%' : '5px' }}
      />
    </div>
  );
}
