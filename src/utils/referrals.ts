const REFERRAL_CODE_STORAGE_KEY = 'monarch_referral_code';
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

// Referral codes are browser-scoped attribution hints, so localStorage keeps them
// available across landing pages without adding app-wide persisted state.
export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim();
  if (!code || !REFERRAL_CODE_PATTERN.test(code)) return null;
  return code.toLowerCase();
}

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeReferralCode(window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY));
}

export function storeReferralCodeOnce(code: string): boolean {
  if (typeof window === 'undefined') return false;
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode || getStoredReferralCode()) return false;

  window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalizedCode);
  return true;
}
