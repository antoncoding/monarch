'use client';
import { Select, SelectItem } from '@heroui/react';
import Image from 'next/image';
import { type SupportedNetworks, getNetworkImg, isSupportedChain, networks } from '@/utils/networks';

type FilterProps = {
  selectedNetwork: SupportedNetworks | null;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
};
export default function NetworkFilter({ setSelectedNetwork, selectedNetwork }: FilterProps) {
  return (
    <Select
      suppressHydrationWarning
      label="Network"
      selectionMode="single"
      placeholder="All networks"
      selectedKeys={selectedNetwork ? [selectedNetwork.toString()] : []}
      onChange={(e) => {
        if (!e.target.value) setSelectedNetwork(null);
        const newId = Number(e.target.value);
        if (newId && isSupportedChain(newId)) {
          setSelectedNetwork(newId);
        }
      }}
      classNames={{
        trigger: 'bg-surface rounded-sm min-w-48',
        popoverContent: 'bg-surface rounded-sm',
      }}
      items={networks}
      renderValue={(items) => {
        return (
          <div className="flex-scroll flex gap-1">
            {items.map((item) => {
              const networkImg = getNetworkImg(Number(item.key));
              return networkImg ? (
                <Image key={item.key} src={networkImg} alt="icon" height="18" />
              ) : (
                <span key={item.key}>{item.textValue}</span>
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
