import { Inter, Zen_Kaku_Gothic_Antique } from 'next/font/google';

export const roboto = Zen_Kaku_Gothic_Antique({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-roboto-mono',
});

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
