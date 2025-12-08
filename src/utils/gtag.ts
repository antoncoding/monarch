import isClient from './isClient';

export const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? '';

type WindowWithGtag = Window & {
  gtag?: any;
};

export const logPageview = (url: string) => {
  if (!isClient()) {
    return;
  }
  const gtag = (window as WindowWithGtag).gtag;
  if (!gtag) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  gtag('config', GOOGLE_ANALYTICS_ID, {
    page_path: url,
  });
};

export const logEvent = ({ action, category, label, value }: { action: string; category: string; label: string; value: number }) => {
  if (!isClient()) {
    return;
  }
  const gtag = (window as WindowWithGtag).gtag;
  if (!gtag) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
