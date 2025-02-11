import React, { useCallback } from 'react';
import { toast, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { StyledToast } from '../components/common/StyledToast';

export function useStyledToast() {
  const success = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.success(<StyledToast title={title} message={message} />, options);
  }, []);

  const error = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.error(<StyledToast title={title} message={message} />, options);
  }, []);

  const info = useCallback((title: string, message?: string, options?: ToastOptions) => {
    toast.info(<StyledToast title={title} message={message} />, options);
  }, []);

  return { success, error, info };
}
