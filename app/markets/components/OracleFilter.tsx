import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
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
  const mounted = useRef(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mounted.current &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      mounted.current = false;
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

  const clearSelection = () => {
    setSelectedOracles([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`min-w-48 cursor-pointer rounded-sm bg-secondary p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-secondary-dark' : ''
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
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-sm bg-secondary shadow-lg">
          <ul className="custom-scrollbar max-h-60 overflow-auto pb-12" role="listbox">
            {Object.values(OracleVendors).map((oracle) => (
              <li
                key={oracle}
                className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-700 ${
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
                <span>{oracle}</span>
                {OracleVendorIcons[oracle] && (
                  <Image src={OracleVendorIcons[oracle]} alt={oracle} width={18} height={18} />
                )}
              </li>
            ))}
          </ul>
          <div className="absolute bottom-0 left-0 right-0 border-gray-700 bg-secondary p-2">
            <button
              className="flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary hover:bg-primary"
              onClick={clearSelection}
              type="button"
            >
              <span>Clear All</span>
              <ChevronDownIcon className="h-5 w-5 rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
