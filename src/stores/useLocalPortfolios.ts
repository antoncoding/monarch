import { getAddress, isAddress } from 'viem';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_PORTFOLIO_ACCOUNTS = 20;

export type LocalPortfolio = {
  id: string;
  slug: string;
  name: string;
  accounts: `0x${string}`[];
  createdAt: number;
  updatedAt: number;
};

type LocalPortfoliosStore = {
  portfolios: LocalPortfolio[];
  createPortfolio: (name: string, accounts?: string[]) => LocalPortfolio;
  updatePortfolio: (id: string, updates: { name: string; accounts: string[] }) => void;
  deletePortfolio: (id: string) => void;
  addAccount: (id: string, account: string) => void;
  removeAccount: (id: string, account: string) => void;
};

const normalizeName = (name: string) => name.trim().slice(0, 64);

const SLUG_DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const SLUG_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const SLUG_EDGE_PATTERN = /^-+|-+$/g;
const SLUG_TRAILING_PATTERN = /-+$/g;

const normalizeSlug = (name: string) =>
  name
    .normalize('NFKD')
    .replace(SLUG_DIACRITICS_PATTERN, '')
    .toLowerCase()
    .replace(SLUG_SEPARATOR_PATTERN, '-')
    .replace(SLUG_EDGE_PATTERN, '')
    .slice(0, 32)
    .replace(SLUG_TRAILING_PATTERN, '') || 'portfolio';

const createUniqueSlug = (name: string, usedSlugs: Set<string>) => {
  const base = normalizeSlug(name);
  if (!usedSlugs.has(base)) return base;

  let suffix = 2;
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

const normalizeAccounts = (accounts: string[]): `0x${string}`[] => {
  const unique = new Map<string, `0x${string}`>();

  for (const account of accounts) {
    if (!isAddress(account, { strict: false })) continue;
    const checksummed = getAddress(account);
    unique.set(checksummed.toLowerCase(), checksummed);
    if (unique.size === MAX_PORTFOLIO_ACCOUNTS) break;
  }

  return Array.from(unique.values());
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `portfolio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useLocalPortfolios = create<LocalPortfoliosStore>()(
  persist(
    (set, get) => ({
      portfolios: [],
      createPortfolio: (name, accounts = []) => {
        const id = createId();
        const now = Date.now();
        const normalizedName = normalizeName(name) || 'Untitled portfolio';
        const portfolio: LocalPortfolio = {
          id,
          slug: createUniqueSlug(normalizedName, new Set(get().portfolios.map((entry) => entry.slug))),
          name: normalizedName,
          accounts: normalizeAccounts(accounts),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ portfolios: [...state.portfolios, portfolio] }));
        return portfolio;
      },
      updatePortfolio: (id, updates) => {
        const name = normalizeName(updates.name);
        if (!name) return;
        set((state) => ({
          portfolios: state.portfolios.map((portfolio) =>
            portfolio.id === id
              ? {
                  ...portfolio,
                  name,
                  accounts: normalizeAccounts(updates.accounts),
                  updatedAt: Date.now(),
                }
              : portfolio,
          ),
        }));
      },
      deletePortfolio: (id) => {
        set((state) => ({ portfolios: state.portfolios.filter((portfolio) => portfolio.id !== id) }));
      },
      addAccount: (id, account) => {
        if (!isAddress(account, { strict: false })) return;
        set((state) => ({
          portfolios: state.portfolios.map((portfolio) => {
            if (portfolio.id !== id || portfolio.accounts.length >= MAX_PORTFOLIO_ACCOUNTS) return portfolio;
            const accounts = normalizeAccounts([...portfolio.accounts, account]);
            if (accounts.length === portfolio.accounts.length) return portfolio;
            return { ...portfolio, accounts, updatedAt: Date.now() };
          }),
        }));
      },
      removeAccount: (id, account) => {
        const normalized = account.toLowerCase();
        set((state) => ({
          portfolios: state.portfolios.map((portfolio) =>
            portfolio.id === id
              ? {
                  ...portfolio,
                  accounts: portfolio.accounts.filter((entry) => entry.toLowerCase() !== normalized),
                  updatedAt: Date.now(),
                }
              : portfolio,
          ),
        }));
      },
    }),
    {
      name: 'monarch_store_localPortfolios',
      version: 2,
      partialize: (state) => ({ portfolios: state.portfolios }),
      migrate: (state) => {
        if (!state || typeof state !== 'object') return { portfolios: [] };

        const persisted = state as {
          portfolios?: Array<Omit<LocalPortfolio, 'slug'> & { slug?: string }>;
        };
        const usedSlugs = new Set<string>();
        const portfolios = (persisted.portfolios ?? []).map((portfolio) => {
          const slug = createUniqueSlug(portfolio.slug ?? portfolio.name, usedSlugs);
          usedSlugs.add(slug);
          return { ...portfolio, slug };
        });

        return { portfolios };
      },
    },
  ),
);
