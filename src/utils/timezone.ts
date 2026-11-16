export const LOCAL_TIME_ZONE = 'local';

const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type DateTimeFormatKind = 'date' | 'dateTime' | 'time';

function createFormatter(timeZonePreference: string, kind: DateTimeFormatKind): Intl.DateTimeFormat {
  const timeZone = timeZonePreference === LOCAL_TIME_ZONE ? undefined : timeZonePreference;
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: kind === 'date' ? 'short' : '2-digit',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  };
  const options = kind === 'date' ? dateOptions : kind === 'time' ? timeOptions : { ...dateOptions, ...timeOptions };

  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function formatDateInTimeZone(date: Date, timeZonePreference: string): string {
  if (!Number.isFinite(date.getTime())) return '-';
  return createFormatter(timeZonePreference, 'date').format(date);
}

export function formatDateTimeInTimeZone(date: Date, timeZonePreference: string): string {
  if (!Number.isFinite(date.getTime())) return '-';

  const parts = createFormatter(timeZonePreference, 'dateTime').formatToParts(date);
  const datePart = `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
  const timePart = `${getPart(parts, 'hour')}:${getPart(parts, 'minute')}:${getPart(parts, 'second')}`;
  const zonePart = getPart(parts, 'timeZoneName');
  return `${datePart} ${timePart}${zonePart ? ` ${zonePart}` : ''}`;
}

export function formatTimeInTimeZone(date: Date, timeZonePreference: string): string {
  if (!Number.isFinite(date.getTime())) return '-';

  const parts = createFormatter(timeZonePreference, 'time').formatToParts(date);
  const timePart = `${getPart(parts, 'hour')}:${getPart(parts, 'minute')}:${getPart(parts, 'second')}`;
  const zonePart = getPart(parts, 'timeZoneName');
  return `${timePart}${zonePart ? ` ${zonePart}` : ''}`;
}

export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getSupportedTimeZones(): string[] {
  try {
    const intlWithSupportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
    const supportedTimeZones = intlWithSupportedValues.supportedValuesOf?.('timeZone');
    if (supportedTimeZones?.length) return supportedTimeZones;
  } catch {
    // Fall through to the compact compatibility list.
  }

  return FALLBACK_TIME_ZONES;
}

export function getTimeZoneLabel(timeZonePreference: string): string {
  if (timeZonePreference === LOCAL_TIME_ZONE) {
    return `Local (${getLocalTimeZone().replaceAll('_', ' ')})`;
  }

  return timeZonePreference.replaceAll('_', ' ');
}
