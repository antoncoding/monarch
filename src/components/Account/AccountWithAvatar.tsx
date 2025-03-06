import { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { getSlicedAddress } from '@/utils/address';

type AccountWithAvatarProps = {
  address: Address;
};

function AccountWithSmallAvatar({ address }: AccountWithAvatarProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <Avatar address={address as `0x${string}`} size={16} />
      <span className="font-inter text-sm font-medium text-primary">
        {getSlicedAddress(address as `0x${string}`)}
      </span>
    </div>
  );
}

export default AccountWithSmallAvatar;
