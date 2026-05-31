import referralStorage from 'local-storage-fallback';

const REFERRAL_CODE_STORAGE_KEY = 'monarch_referral_code';
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const canUseReferralStorage = typeof window !== 'undefined';

// Browser-only attribution hint; not user settings or shared app state.
export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim();
  if (!code || !REFERRAL_CODE_PATTERN.test(code)) return null;
  return code.toLowerCase();
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
