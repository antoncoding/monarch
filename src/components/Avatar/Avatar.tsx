import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Address } from 'viem';
import { MORPHO } from '@/utils/morpho';

type AvatarProps = {
  address: Address;
  size?: number;
};

export function Avatar({ address, size = 30 }: AvatarProps) {
  const [useEffigy, setUseEffigy] = useState(true);
  const effigyUrl = `https://effigy.im/a/${address}.svg`;
  const dicebearUrl = `https://api.dicebear.com/7.x/pixel-art/png?seed=${address}`;

  useEffect(() => {
    const checkEffigyAvailability = async () => {
      const effigyMockurl = `https://effigy.im/a/${MORPHO}.png`;
      try {
        const response = await fetch(effigyMockurl, { method: 'HEAD' });
        setUseEffigy(response.ok);
      } catch (error) {
        setUseEffigy(false);
      }
    };

    void checkEffigyAvailability();
  }, []);

  return (
    <div style={{ width: size, height: size }}>
      <Image
        src={useEffigy ? effigyUrl : dicebearUrl}
        alt={`Avatar for ${address}`}
        width={size}
        height={size}
        style={{ borderRadius: '50%' }}
        onError={() => setUseEffigy(false)}
      />
    </div>
  );
}
