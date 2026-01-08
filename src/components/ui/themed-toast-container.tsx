'use client';

import { useTheme } from 'next-themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();

  return (
    <ToastContainer
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastStyle={{ borderRadius: '3px', fontSize: '16px' }}
    />
  );
}
