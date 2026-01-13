import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { cn } from '@/utils/components';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';

type OracleFilterProps = {
  selectedOracles: PriceFeedVendors[];
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
  availableOracles?: PriceFeedVendors[];
  showLabelPrefix?: boolean;
};

export default function OracleFilter({
  selectedOracles,
  setSelectedOracles,
  availableOracles,
  showLabelPrefix = false,
}: OracleFilterProps) {
  // Use provided oracles or default to all
  const oraclesToShow = availableOracles ?? Object.values(PriceFeedVendors);
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

  const clearSelection = () => {
    setSelectedOracles([]);
    setIsOpen(false);
  };

  return (
    <div
      className="relative font-zen"
      ref={dropdownRef}
    >
      <button
        type="button"
        className={cn(
          'bg-surface flex h-10 items-center gap-2 rounded-sm px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
          'min-w-[120px] max-w-[220px]',
          isOpen && 'min-w-[180px]',
        )}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-1 items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {showLabelPrefix && <span className="text-sm text-secondary">Oracle:</span>}
            {selectedOracles.length > 0 ? (
              <div className="flex items-center gap-1">
                {selectedOracles.slice(0, 3).map((oracle) => (
                  <div key={oracle}>
                    {OracleVendorIcons[oracle] ? (
                      <Image
                        src={OracleVendorIcons[oracle]}
                        alt={oracle}
                        height={14}
                        width={14}
                      />
                    ) : (
                      <IoHelpCircleOutline
                        className="text-secondary"
                        size={14}
                      />
                    )}
                  </div>
                ))}
                {selectedOracles.length > 3 && <span className="text-xs text-secondary">+{selectedOracles.length - 3}</span>}
              </div>
            ) : (
              <span className="text-sm text-secondary">All</span>
            )}
          </div>
        </div>
        <ChevronDownIcon className={cn('h-4 w-4 text-secondary transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'bg-surface absolute z-10 mt-1 w-full min-w-[200px] rounded-sm shadow-lg transition-all duration-200',
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
      >
        <div className="relative">
          <ul
            className="custom-scrollbar max-h-60 overflow-auto pb-10"
            role="listbox"
          >
            {oraclesToShow.map((oracle) => (
              <li
                key={oracle}
                className={cn(
                  'm-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                  selectedOracles.includes(oracle) && 'bg-gray-100 dark:bg-gray-800',
                )}
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
                    <IoHelpCircleOutline
                      className="text-secondary"
                      size={16}
                    />
                  )}
                  <span>{oracle === PriceFeedVendors.Unknown ? 'Unknown Feed' : oracle}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-1.5">
            <button
              className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
              onClick={clearSelection}
              type="button"
            >
              <span>Clear All</span>
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
