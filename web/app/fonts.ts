import { Inter, Zen_Kaku_Gothic_Antique } from 'next/font/google';

export const zen = Zen_Kaku_Gothic_Antique({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-zen',
});

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: '200',
});
