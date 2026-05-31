import referralStorage from 'local-storage-fallback';
import { isAddress } from 'viem';

const REFERRAL_CODE_STORAGE_KEY = 'monarch_referral_code';
const OWN_REFERRAL_CODE_STORAGE_PREFIX = 'monarch_own_referral_code';
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const canUseReferralStorage = typeof window !== 'undefined';

// Browser-only attribution hint; not user settings or shared app state.
export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim();
  if (!code || !REFERRAL_CODE_PATTERN.test(code)) return null;
  return code;
}

export function getStoredReferralCode(): string | null {
  if (!canUseReferralStorage) return null;

  try {
    return normalizeReferralCode(referralStorage.getItem(REFERRAL_CODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeReferralCodeOnce(code: string): boolean {
  if (!canUseReferralStorage) return false;

  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode || getStoredReferralCode()) return false;

  try {
    referralStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalizedCode);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredReferralCode(): void {
  if (!canUseReferralStorage) return;

  try {
    referralStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch {
    return;
  }
}

export function getOwnReferralCode(address: string): string | null {
  if (!canUseReferralStorage || !isAddress(address)) return null;

  try {
    return normalizeReferralCode(referralStorage.getItem(getOwnReferralCodeStorageKey(address)));
  } catch {
    return null;
  }
}

export function storeOwnReferralCode(address: string, code: string): void {
  if (!canUseReferralStorage || !isAddress(address)) return;

  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) return;

  try {
    referralStorage.setItem(getOwnReferralCodeStorageKey(address), normalizedCode);
  } catch {
    return;
  }
}

function getOwnReferralCodeStorageKey(address: string) {
  return `${OWN_REFERRAL_CODE_STORAGE_PREFIX}_${address.toLowerCase()}`;
}
