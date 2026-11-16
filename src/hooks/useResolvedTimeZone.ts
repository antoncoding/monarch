'use client';

import { useEffect, useState } from 'react';
import { useAppSettings } from '@/stores/useAppSettings';
import { getLocalTimeZone, LOCAL_TIME_ZONE } from '@/utils/timezone';

export function useResolvedTimeZone(): string {
  const timeZonePreference = useAppSettings((state) => state.timeZone);
  // Keep the server and first client render stable, then resolve the browser zone after hydration.
  const [localTimeZone, setLocalTimeZone] = useState('UTC');

  useEffect(() => {
    setLocalTimeZone(getLocalTimeZone());
  }, []);

  return timeZonePreference === LOCAL_TIME_ZONE ? localTimeZone : timeZonePreference;
}
