import React from 'react';
import { Pagination as NextUIPagination, Modal, ModalContent, ModalHeader, ModalBody, Button, useDisclosure, Input } from "@nextui-org/react";
import storage from 'local-storage-fallback';
import { FiSettings } from 'react-icons/fi';
import { MarketEntriesPerPageKey } from '@/utils/storageKeys';

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  entriesPerPage: number;
  onEntriesPerPageChange: (entries: number) => void;
};

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
  entriesPerPage,
  onEntriesPerPageChange
}: PaginationProps) {
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const [customEntries, setCustomEntries] = React.useState(entriesPerPage.toString());

  const handleEntriesPerPageChange = (value: number) => {
    onEntriesPerPageChange(value);
    storage.setItem(MarketEntriesPerPageKey, value.toString());
    onPageChange(1); // Reset to first page
    onOpenChange(); // Close the modal
  };

  const handleCustomEntriesChange = () => {
    const value = parseInt(customEntries, 10);
    if (!isNaN(value) && value > 0) {
      handleEntriesPerPageChange(value);
    }
  };

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="flex items-center">
        <NextUIPagination
          showControls
          total={totalPages}
          page={currentPage}
          onChange={onPageChange}
          classNames={{
            wrapper: "gap-0 overflow-visible h-8",
            item: "w-8 h-8 text-small rounded-sm bg-transparent",
            cursor: "bg-orange-500 text-white font-bold",
          }}
          size='md'
        />
        <Button
          isIconOnly
          aria-label="Settings"
          className="ml-2 bg-secondary"
          onClick={onOpen}
          size='md'
        >
          <FiSettings />
        </Button>
      </div>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 font-inter mt-8 mx-8 p-4">Settings</ModalHeader>
              <ModalBody className="font-inter mx-8 my-4 p-4">
                <div className="flex flex-col items-center space-y-4">
                  <p className='w-full text-left'>Entries per page:</p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="flex">
                      {[8, 16, 32].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          onClick={() => handleEntriesPerPageChange(value)}
                          className={`px-2 ${
                            entriesPerPage === value
                              ? 'bg-orange-500 text-white'
                              : 'bg-secondary hover:bg-orange-200'
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
                      <Button size="sm" onClick={handleCustomEntriesChange}>Set</Button>
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