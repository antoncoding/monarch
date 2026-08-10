import { getAddress, isAddress } from 'viem';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_PORTFOLIO_ACCOUNTS = 20;

type LocalPortfolio = {
  slug: string;
  name: string;
  accounts: `0x${string}`[];
};

type LocalPortfoliosStore = {
  portfolios: LocalPortfolio[];
  createPortfolio: (name: string, accounts?: string[]) => LocalPortfolio;
  updatePortfolio: (slug: string, updates: { name: string; accounts: string[] }) => void;
  deletePortfolio: (slug: string) => void;
  toggleAccount: (slug: string, account: string) => void;
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

export const useLocalPortfolios = create<LocalPortfoliosStore>()(
  persist(
    (set, get) => ({
      portfolios: [],
      createPortfolio: (name, accounts = []) => {
        const normalizedName = normalizeName(name) || 'Untitled portfolio';
        const portfolio: LocalPortfolio = {
          slug: createUniqueSlug(normalizedName, new Set(get().portfolios.map((entry) => entry.slug))),
          name: normalizedName,
          accounts: normalizeAccounts(accounts),
        };
        set((state) => ({ portfolios: [...state.portfolios, portfolio] }));
        return portfolio;
      },
      updatePortfolio: (slug, updates) => {
        const name = normalizeName(updates.name);
        if (!name) return;
        set((state) => ({
          portfolios: state.portfolios.map((portfolio) =>
            portfolio.slug === slug
              ? {
                  ...portfolio,
                  name,
                  accounts: normalizeAccounts(updates.accounts),
                }
              : portfolio,
          ),
        }));
      },
      deletePortfolio: (slug) => {
        set((state) => ({ portfolios: state.portfolios.filter((portfolio) => portfolio.slug !== slug) }));
      },
      toggleAccount: (slug, account) => {
        if (!isAddress(account, { strict: false })) return;
        const normalized = getAddress(account);
        const accountKey = normalized.toLowerCase();
        set((state) => ({
          portfolios: state.portfolios.map((portfolio) => {
            if (portfolio.slug !== slug) return portfolio;
            const included = portfolio.accounts.some((entry) => entry.toLowerCase() === accountKey);
            if (included) {
              return { ...portfolio, accounts: portfolio.accounts.filter((entry) => entry.toLowerCase() !== accountKey) };
            }
            if (portfolio.accounts.length >= MAX_PORTFOLIO_ACCOUNTS) return portfolio;
            return { ...portfolio, accounts: [...portfolio.accounts, normalized] };
          }),
        }));
      },
    }),
    {
      name: 'monarch_store_localPortfolios',
      version: 2,
      partialize: (state) => ({ portfolios: state.portfolios }),
    },
  ),
);
