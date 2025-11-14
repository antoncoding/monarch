import { useCallback } from 'react';
import { toast, ExternalToast } from 'sonner';

type ToastMessage = string | undefined;

export function useStyledToast() {
  const success = useCallback(
    (title: string, messageOrOptions?: ToastMessage | ExternalToast, options?: ExternalToast) => {
      // If second param is an object, treat it as options
      const isSecondParamOptions =
        typeof messageOrOptions === 'object' && messageOrOptions !== null;
      const message = isSecondParamOptions ? undefined : (messageOrOptions as string | undefined);
      const finalOptions = isSecondParamOptions
        ? (messageOrOptions as ExternalToast)
        : options;

      toast.success(title, {
        description: message,
        className: 'font-zen',
        descriptionClassName: 'font-inter text-xs',
        ...finalOptions,
      });
    },
    [],
  );

  const error = useCallback(
    (title: string, messageOrOptions?: ToastMessage | ExternalToast, options?: ExternalToast) => {
      const isSecondParamOptions =
        typeof messageOrOptions === 'object' && messageOrOptions !== null;
      const message = isSecondParamOptions ? undefined : (messageOrOptions as string | undefined);
      const finalOptions = isSecondParamOptions
        ? (messageOrOptions as ExternalToast)
        : options;

      toast.error(title, {
        description: message,
        className: 'font-zen',
        descriptionClassName: 'font-inter text-xs',
        ...finalOptions,
      });
    },
    [],
  );

  const info = useCallback(
    (title: string, messageOrOptions?: ToastMessage | ExternalToast, options?: ExternalToast) => {
      const isSecondParamOptions =
        typeof messageOrOptions === 'object' && messageOrOptions !== null;
      const message = isSecondParamOptions ? undefined : (messageOrOptions as string | undefined);
      const finalOptions = isSecondParamOptions
        ? (messageOrOptions as ExternalToast)
        : options;

      toast.info(title, {
        description: message,
        className: 'font-zen',
        descriptionClassName: 'font-inter text-xs',
        ...finalOptions,
      });
    },
    [],
  );

  return { success, error, info };
}
