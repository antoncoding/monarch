import React, { useEffect, useState } from 'react';
import {
  Pagination as NextUIPagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  useDisclosure,
  Input,
} from '@nextui-org/react';
import { FiSettings } from 'react-icons/fi';

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  entriesPerPage: number;
  onEntriesPerPageChange: (entries: number) => void;
  isDataLoaded: boolean; // New prop to check if data is loaded
};

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
  entriesPerPage,
  onEntriesPerPageChange,
  isDataLoaded, // New prop
}: PaginationProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [customEntries, setCustomEntries] = useState(entriesPerPage.toString());

  const handleEntriesChange = (value: number) => {
    onEntriesPerPageChange(value);
    onOpenChange(); // Close the modal
  };

  const handleCustomEntriesChange = () => {
    const value = parseInt(customEntries, 10);
    if (!isNaN(value) && value > 0) {
      handleEntriesChange(value);
    }
  };

  // Force re-render when data is loaded
  useEffect(() => {
    if (isDataLoaded) {
      onPageChange(1); // Reset to first page when data loads
    }
  }, [isDataLoaded, onPageChange]);

  if (!isDataLoaded || totalPages === 0) {
    return null; // Don't render pagination if data isn't loaded or there are no pages
  }

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="flex items-center">
        <NextUIPagination
          key={`pagination-${isDataLoaded}-${totalPages}`} // Force re-render when these change
          showControls
          total={totalPages}
          page={currentPage}
          initialPage={1}
          onChange={onPageChange}
          classNames={{
            wrapper: 'gap-0 overflow-visible h-8',
            item: 'w-8 h-8 text-small rounded-sm bg-transparent',
            cursor: 'bg-orange-500 text-white font-bold',
          }}
          size="md"
        />
        <Button
          isIconOnly
          aria-label="Settings"
          className="bg-surface ml-2"
          onClick={onOpen}
          size="md"
        >
          <FiSettings />
        </Button>
      </div>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="mx-8 mt-8 flex flex-col gap-1 p-4 font-inter">
                Settings
              </ModalHeader>
              <ModalBody className="mx-8 my-4 p-4 font-inter">
                <div className="flex flex-col items-center space-y-4">
                  <p className="w-full text-left">Entries per page:</p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="flex">
                      {[6, 15, 24].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          onClick={() => handleEntriesChange(value)}
                          className={`px-2 ${
                            entriesPerPage === value
                              ? 'bg-orange-500 text-white'
                              : 'bg-surface hover:bg-orange-200'
                          }`}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        label="Custom"
                        value={customEntries}
                        onChange={(e) => setCustomEntries(e.target.value)}
                        min="1"
                        size="sm"
                        className="w-20"
                      />
                      <Button size="sm" onClick={handleCustomEntriesChange}>
                        Set
                      </Button>
                    </div>
                  </div>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
