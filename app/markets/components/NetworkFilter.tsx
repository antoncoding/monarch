'use client';
import { Select, SelectItem, } from '@nextui-org/react';
import Image from 'next/image';
import { SupportedNetworks, getNetworkImg, isSupportedChain, networks } from '@/utils/networks';


type FilterProps = {
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
}
export default function NetworkFilter({setSelectedNetwork} : FilterProps) {

  return (
    
    <Select
      label="Network"
      selectionMode="single"
      placeholder="All networks"
      onChange={(e) => {
        if (!e.target.value) setSelectedNetwork(null);
        const newId = Number(e.target.value);
        if (newId && isSupportedChain(newId)) {
          setSelectedNetwork(newId);
        }
      }}
      classNames={{
        trigger: 'bg-secondary rounded-sm min-w-32',
        popoverContent: 'bg-secondary rounded-sm',
      }}
      items={networks}
      renderValue={(items) => {
        return (
          <div className="flex-scroll flex gap-1">
            {items.map((item) => {
              const networkImg = getNetworkImg(Number(item.key));
              return networkImg ? (
                <Image src={networkImg} alt="icon" height="18" />
              ) : (
                item.textValue
              );
            })}
          </div>
        );
      }}
    >
      {networks.map((network) => {
        return (
          <SelectItem key={network.network} textValue={network.name}>
            <div className="flex items-center justify-between">
              <p>{network.name}</p>
              <Image className="ml-auto" src={network.logo} alt="icon" height="18" />
            </div>
          </SelectItem>
        );
      })}
    </Select>
  );
}
