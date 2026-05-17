import localFont from 'next/font/local';

export const inter = localFont({
  src: '../src/fonts/optimized/Inter-Latin.woff2',
  display: 'swap',
  variable: '--font-family-inter',
  preload: false,
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'system-ui',
    'sans-serif',
  ],
});

export const zen = localFont({
  src: [
    {
      path: '../src/fonts/optimized/ZenKakuGothicNew-Regular-Latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../src/fonts/optimized/ZenKakuGothicNew-Medium-Latin.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../src/fonts/optimized/ZenKakuGothicNew-Bold-Latin.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-family-zen',
  preload: false,
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'system-ui',
    'sans-serif',
  ],
});

export const victorMono = localFont({
  src: '../src/fonts/optimized/VictorMono-Latin.woff2',
  display: 'swap',
  variable: '--font-family-monospace',
  preload: false,
  fallback: [
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace',
  ],
});
