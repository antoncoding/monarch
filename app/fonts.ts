import localFont from 'next/font/local';

export const zen = localFont({
  src: [
    {
      path: '../src/fonts/Zen_Kaku_Gothic_New/ZenKakuGothicNew-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../src/fonts/Zen_Kaku_Gothic_New/ZenKakuGothicNew-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-zen',
});

export const inter = localFont({
  src: [
    {
      path: '../src/fonts/Inter/static/Inter-Light.ttf',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../src/fonts/Inter/static/Inter-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-inter',
});

export const monospace = localFont({
  src: '../src/fonts/JetBrains_Mono/JetBrainsMono-VariableFont_wght.ttf',
  display: 'swap',
  variable: '--font-monospace',
});
