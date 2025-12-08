import isClient from './isClient';

export const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? '';

type WindowWithGtag = Window & {
  gtag: any;
};

export const logPageview = (url: string) => {
  if (!isClient()) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (window as WindowWithGtag).gtag('config', GOOGLE_ANALYTICS_ID, {
    page_path: url,
  });
};

export const logEvent = ({ action, category, label, value }: { action: string; category: string; label: string; value: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (window as WindowWithGtag).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
