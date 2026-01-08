import { useCallback } from 'react';
import { toast, type ToastOptions } from 'react-toastify';
import { StyledToast } from '../components/ui/styled-toast';

export function useStyledToast() {
  const success = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.success(
      <StyledToast
        title={title}
        message={message}
      />,
      options,
    );
  }, []);

  const error = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.error(
      <StyledToast
        title={title}
        message={message}
      />,
      options,
    );
  }, []);

  const info = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.info(
      <StyledToast
        title={title}
        message={message}
      />,
      options,
    );
  }, []);

  return { success, error, info };
}
