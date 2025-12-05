/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
const { heroui } = require('@heroui/theme');

const MONARCH_PRIMARY = '#f45f2d'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-2': 'linear-gradient(270deg, #f55925 0%, #D75986 100%)',
      },
      gridTemplateColumns: {
        // Coffee column grid
        '2CoffeeLg': '1fr 380px',
        '2CoffeeMd': '1fr 330px',

        // Mint colum grid
        '2mint': '420px 1fr',
      },
      colors: {
        primary: MONARCH_PRIMARY,
        'monarch-primary': MONARCH_PRIMARY,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // primary: {
        //   DEFAULT: 'hsl(var(--primary))',
        //   foreground: 'hsl(var(--primary-foreground))',
        // },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        inter: ['var(--font-inter)'],
        zen: ['var(--font-zen)'],
        monospace: ['var(--font-monospace)'],
      },
      fontWeight: {
        normal: '400',
        bold: '700',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          layout: {
            radius: {
              small: '0.375rem', // rounded
              medium: '0.375rem', // rounded
              large: '0.375rem', // rounded
            },
          },
        },
        dark: {
          layout: {
            radius: {
              small: '0.375rem', // rounded
              medium: '0.375rem', // rounded
              large: '0.375rem', // rounded
            },
          },
          colors: {
            content1: '#222529', // Modal background
          },
        },
      },
    }),
    plugin(function ({ addBase }) {
      addBase({
        'button, .nextui-button': {
          '@apply rounded': {}, // This makes all buttons rounded by default
        },
      });
    }),
  ],
};

export default config;
