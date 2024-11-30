import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Address } from 'viem';

interface AvatarProps {
  address: Address;
  size?: number;
}

export function Avatar({ address, size = 30 }: AvatarProps) {
  const [useEffigy, setUseEffigy] = useState(true);
  const effigyUrl = `https://effigy.im/a/${address}.svg`;
  const dicebearUrl = `https://api.dicebear.com/7.x/pixel-art/png?seed=${address}`;

  useEffect(() => {
    const checkEffigyAvailability = async () => {
      try {
        const response = await fetch(effigyUrl, { method: 'HEAD' });
        setUseEffigy(response.ok);
      } catch (error) {
        setUseEffigy(false);
      }
    };

    checkEffigyAvailability();
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
