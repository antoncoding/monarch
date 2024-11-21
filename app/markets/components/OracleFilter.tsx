import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { FaQuestionCircle } from 'react-icons/fa';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle';
import { MorphoChainlinkOracleData } from '@/utils/types';

type OracleFilterProps = {
  selectedOracles: OracleVendors[];
  setSelectedOracles: (oracles: OracleVendors[]) => void;
};

export default function OracleFilter({ selectedOracles, setSelectedOracles }: OracleFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const toggleOracle = (oracle: OracleVendors) => {
    if (selectedOracles.includes(oracle)) {
      setSelectedOracles(selectedOracles.filter((o) => o !== oracle));
    } else {
      setSelectedOracles([...selectedOracles, oracle]);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`bg-surface min-w-48 cursor-pointer rounded p-2 shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="absolute left-2 top-2 px-1 text-xs">Oracle</span>
        <div className="flex items-center justify-between pt-4">
          {selectedOracles.length > 0 ? (
            <div className="flex-scroll flex gap-2 px-1">
              {selectedOracles.map((oracle) => (
                <OracleVendorBadge
                  key={oracle}
                  oracleData={
                    { baseFeedOne: { vendor: oracle } } as unknown as MorphoChainlinkOracleData
                  }
                  showText={false}
                  useTooltip={false}
                />
              ))}
            </div>
          ) : (
            <span className="p-[2px] text-sm text-gray-400">All oracles</span>
          )}
          <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </div>
      <div
        className={`bg-surface absolute z-10 mt-1 w-full transform rounded shadow-lg transition-all duration-200 ${
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <ul className="custom-scrollbar max-h-60 overflow-auto" role="listbox">
          {Object.values(OracleVendors).map((oracle) => (
            <li
              key={oracle}
              className={`m-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-200 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                selectedOracles.includes(oracle) ? 'bg-gray-300 dark:bg-gray-700' : ''
              }`}
              onClick={() => toggleOracle(oracle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleOracle(oracle);
                }
              }}
              role="option"
              aria-selected={selectedOracles.includes(oracle)}
              tabIndex={0}
            >
              <div className="flex items-center gap-2">
                {OracleVendorIcons[oracle] ? (
                  <Image
                    src={OracleVendorIcons[oracle]}
                    alt={oracle}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                ) : (
                  <FaQuestionCircle className="h-4 w-4 text-gray-400" />
                )}
                <span>{oracle}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
