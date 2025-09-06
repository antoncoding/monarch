import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';

type OracleFilterProps = {
  selectedOracles: PriceFeedVendors[];
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
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

  const toggleOracle = (oracle: PriceFeedVendors) => {
    if (selectedOracles.includes(oracle)) {
      setSelectedOracles(selectedOracles.filter((o) => o !== oracle));
    } else {
      setSelectedOracles([...selectedOracles, oracle]);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`bg-surface min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
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
            <div className="flex-scroll flex gap-2 p-1">
              {selectedOracles.map((oracle, index) => (
                <div key={index}>
                  {OracleVendorIcons[oracle] ? (
                    <Image
                      src={OracleVendorIcons[oracle]}
                      alt={oracle}
                      height={16}
                      width={16}
                    />
                  ) : (
                    <IoHelpCircleOutline className="text-secondary" size={16} />
                  )}
                </div>
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
        className={`bg-surface absolute z-10 mt-1 w-full transform rounded-sm shadow-lg transition-all duration-200 ${
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <ul className="custom-scrollbar max-h-60 overflow-auto" role="listbox">
          {Object.values(PriceFeedVendors).map((oracle) => (
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
                  <IoHelpCircleOutline className="text-secondary" size={16} />
                )}
                <span>{oracle === PriceFeedVendors.Unknown ? 'Unknown Feed' : oracle}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
