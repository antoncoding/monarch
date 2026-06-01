'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { storeReferralCodeOnce } from '@/utils/referrals';

export function ReferralTrackingProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('ref');
    if (code) storeReferralCodeOnce(code);
  }, [searchParams]);

  return null;
}
