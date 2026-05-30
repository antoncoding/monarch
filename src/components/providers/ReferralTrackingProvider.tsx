'use client';

import { useEffect } from 'react';
import { storeReferralCodeOnce } from '@/utils/referrals';

export function ReferralTrackingProvider() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('ref') ?? url.searchParams.get('referral');
    if (code) {
      storeReferralCodeOnce(code);
    }
  }, []);

  return null;
}
