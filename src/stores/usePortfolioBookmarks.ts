import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AddressBookmark = {
  address: string;
  addedAt: number;
};

type PositionBookmark = {
  address: string;
  chainId: number;
  loanAssetAddress: string;
  loanAssetSymbol?: string;
  addedAt: number;
};

type VisitedAddress = {
  address: string;
  lastVisited: number;
};

type VisitedPosition = {
  address: string;
  chainId: number;
  loanAssetAddress: string;
  loanAssetSymbol?: string;
  lastVisited: number;
};

type PortfolioBookmarksState = {
  addressBookmarks: AddressBookmark[];
  positionBookmarks: PositionBookmark[];
  visitedAddresses: VisitedAddress[];
  visitedPositions: VisitedPosition[];
};

type PortfolioBookmarksActions = {
  addVisitedAddress: (address: string) => void;
  addVisitedPosition: (entry: Omit<VisitedPosition, 'lastVisited'>) => void;
  toggleAddressBookmark: (address: string) => void;
  togglePositionBookmark: (entry: Omit<PositionBookmark, 'addedAt'>) => void;
  isAddressBookmarked: (address: string) => boolean;
  isPositionBookmarked: (address: string, chainId: number, loanAssetAddress: string) => boolean;
};

type PortfolioBookmarksStore = PortfolioBookmarksState & PortfolioBookmarksActions;

const MAX_VISITED = 12;
const MAX_VISITED_POSITIONS = 12;

const normalizeAddress = (address: string) => address.toLowerCase();

const positionKey = (address: string, chainId: number, loanAssetAddress: string) =>
  `${normalizeAddress(address)}-${chainId}-${normalizeAddress(loanAssetAddress)}`;

export const usePortfolioBookmarks = create<PortfolioBookmarksStore>()(
  persist(
    (set, get) => ({
      addressBookmarks: [],
      positionBookmarks: [],
      visitedAddresses: [],
      visitedPositions: [],
      addVisitedAddress: (address) => {
        const normalized = normalizeAddress(address);
        const now = Date.now();
        const next = [...get().visitedAddresses.filter((entry) => entry.address !== normalized), { address: normalized, lastVisited: now }]
          .sort((a, b) => b.lastVisited - a.lastVisited)
          .slice(0, MAX_VISITED);
        set({ visitedAddresses: next });
      },
      addVisitedPosition: (entry) => {
        const normalizedAddress = normalizeAddress(entry.address);
        const normalizedAsset = normalizeAddress(entry.loanAssetAddress);
        const key = positionKey(normalizedAddress, entry.chainId, normalizedAsset);
        const now = Date.now();
        const next = [
          ...get().visitedPositions.filter(
            (pos) => positionKey(pos.address, pos.chainId, pos.loanAssetAddress) !== key,
          ),
          {
            address: normalizedAddress,
            chainId: entry.chainId,
            loanAssetAddress: normalizedAsset,
            loanAssetSymbol: entry.loanAssetSymbol,
            lastVisited: now,
          },
        ]
          .sort((a, b) => b.lastVisited - a.lastVisited)
          .slice(0, MAX_VISITED_POSITIONS);
        set({ visitedPositions: next });
      },
      toggleAddressBookmark: (address) => {
        const normalized = normalizeAddress(address);
        const exists = get().addressBookmarks.some((entry) => entry.address === normalized);
        if (exists) {
          set({
            addressBookmarks: get().addressBookmarks.filter((entry) => entry.address !== normalized),
          });
          return;
        }
        set({
          addressBookmarks: [
            { address: normalized, addedAt: Date.now() },
            ...get().addressBookmarks.filter((entry) => entry.address !== normalized),
          ],
        });
      },
      togglePositionBookmark: (entry) => {
        const normalizedAddress = normalizeAddress(entry.address);
        const normalizedAsset = normalizeAddress(entry.loanAssetAddress);
        const key = positionKey(normalizedAddress, entry.chainId, normalizedAsset);
        const exists = get().positionBookmarks.some(
          (bookmark) => positionKey(bookmark.address, bookmark.chainId, bookmark.loanAssetAddress) === key,
        );
        if (exists) {
          set({
            positionBookmarks: get().positionBookmarks.filter(
              (bookmark) => positionKey(bookmark.address, bookmark.chainId, bookmark.loanAssetAddress) !== key,
            ),
          });
          return;
        }
        set({
          positionBookmarks: [
            {
              address: normalizedAddress,
              chainId: entry.chainId,
              loanAssetAddress: normalizedAsset,
              loanAssetSymbol: entry.loanAssetSymbol,
              addedAt: Date.now(),
            },
            ...get().positionBookmarks.filter(
              (bookmark) => positionKey(bookmark.address, bookmark.chainId, bookmark.loanAssetAddress) !== key,
            ),
          ],
        });
      },
      isAddressBookmarked: (address) => {
        const normalized = normalizeAddress(address);
        return get().addressBookmarks.some((entry) => entry.address === normalized);
      },
      isPositionBookmarked: (address, chainId, loanAssetAddress) => {
        const key = positionKey(address, chainId, loanAssetAddress);
        return get().positionBookmarks.some(
          (bookmark) => positionKey(bookmark.address, bookmark.chainId, bookmark.loanAssetAddress) === key,
        );
      },
    }),
    {
      name: 'monarch_store_portfolioBookmarks',
      version: 1,
    },
  ),
);
