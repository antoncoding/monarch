import { heroui } from '@heroui/theme';

export default heroui({
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
});
