'use client';
import { Select, SelectItem, SelectSection } from '@nextui-org/react';
import Image from 'next/image';
import { ERC20Token, findTokenWithKey, infoToKey } from '@/utils/tokens';

type FilterProps = {
  label: string
  placeholder: string
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: ERC20Token[]
  loading: boolean
};
export default function AssetFilter({ label, placeholder, selectedAssets, setSelectedAssets, items, loading }: FilterProps) {
  return (
    <Select
      label={label}
      selectionMode="multiple"
      placeholder={placeholder}
      selectedKeys={selectedAssets}
      onChange={(e) => {
        if (!e.target.value) setSelectedAssets([]);
        else setSelectedAssets((e.target.value as string).split(','));
      }}
      classNames={{
        trigger: 'bg-secondary rounded-sm min-w-48',
        popoverContent: 'bg-secondary rounded-sm',
      }}
      items={items}
      // className='w-48 rounded-sm'
      isLoading={loading}
      renderValue={(tokens) => {
        return (
          <div className="flex-scroll flex gap-1">
            {tokens.map((t) => {
              const token = findTokenWithKey(t.key as string);
              return token?.img ? <Image src={token.img} alt="icon" height="18" /> : t.textValue;
            })}
          </div>
        );
      }}
    >
      <SelectSection title="Choose loan assets">
        {items.map((token) => {
          // key = `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-1|0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32-42`
          const key = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
          return (
            <SelectItem key={key} textValue={token.symbol}>
              <div className="flex items-center justify-between">
                <p>{token?.symbol}</p>
                {token.img && <Image src={token.img} alt="icon" height="18" />}
              </div>
            </SelectItem>
          );
        })}
      </SelectSection>
    </Select>
  );
}
