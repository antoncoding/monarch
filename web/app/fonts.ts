import localFont from 'next/font/local';

export const zen = localFont({
  src: '../src/fonts/Zen_Kaku_Gothic_New/ZenKakuGothicNew-Regular.ttf',
  // subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-zen',
});

export const inter = localFont({
  src: '../src/fonts/Inter/static/Inter-Light.ttf',
  // subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: '200',
});
