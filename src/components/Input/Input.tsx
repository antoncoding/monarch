import { useCallback, useState, useEffect } from 'react';

import { parseUnits } from 'viem';
import { formatBalance } from '@/utils/balance';
import { Button } from '@/components/ui/button';

type InputProps = {
  decimals: number;
  setValue: (value: bigint) => void;
  max?: bigint;
  setError?: ((error: string | null) => void) | React.Dispatch<React.SetStateAction<string | null>>;
  exceedMaxErrMessage?: string;
  allowExceedMax?: boolean; // whether to still "setValue" when the input exceeds max
  onMaxClick?: () => void;
  value?: bigint;
  error?: string | null; // current error state to show dismiss button
  endAdornment?: React.ReactNode;
  inputClassName?: string;
};

export default function Input({
  decimals,
  max,
  setValue,
  setError,
  exceedMaxErrMessage,
  allowExceedMax = false,
  onMaxClick,
  value,
  error,
  endAdornment,
  inputClassName,
}: InputProps): JSX.Element {
  // State for the input text
  const [inputAmount, setInputAmount] = useState<string>(value ? formatBalance(value, decimals).toString() : '0');
  // Track if max check is bypassed
  const [bypassMax, setBypassMax] = useState<boolean>(false);

  // Update input text when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setInputAmount(formatBalance(value, decimals).toString());
    }
  }, [value, decimals]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // update the shown input text regardless
      const inputText = e.target.value;
      setInputAmount(inputText);

      try {
        const inputBigInt = parseUnits(inputText, decimals);

        if (max !== undefined && inputBigInt > max && !bypassMax) {
          if (setError) setError(exceedMaxErrMessage ?? 'Input exceeds max');
          if (allowExceedMax) {
            setValue(inputBigInt);
          }
          return;
        }

        setValue(inputBigInt);
        if (setError) setError(null);
      } catch (err) {
        if (setError) setError('Invalid input');
        console.log('e', err);
      }
    },
    [decimals, setError, setInputAmount, setValue, max, exceedMaxErrMessage, allowExceedMax, bypassMax],
  );

  // Dismiss error and bypass max check, re-trigger setValue with current input
  const handleDismissError = useCallback(() => {
    setBypassMax(true);
    if (setError) setError(null);
    try {
      const inputBigInt = parseUnits(inputAmount, decimals);
      setValue(inputBigInt);
    } catch {
      // Invalid input, ignore
    }
  }, [inputAmount, decimals, setValue, setError]);

  // if max is clicked, set the input to the max value
  const handleMax = useCallback(() => {
    if (max) {
      setValue(max);
      // set readable input
      setInputAmount(formatBalance(max, decimals).toString());
    }
    if (onMaxClick) onMaxClick();
  }, [max, decimals, setInputAmount, setValue, onMaxClick]);

  return (
    <div className="flex-grow">
      <div className="relative">
        <input
          type="number"
          value={inputAmount}
          onChange={onInputChange}
          className={`bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none ${
            endAdornment != null && max !== undefined && max !== BigInt(0)
              ? 'pr-20'
              : endAdornment != null || (max !== undefined && max !== BigInt(0))
                ? 'pr-12'
                : ''
          } ${inputClassName ?? ''}`}
        />
        {max !== undefined && max !== BigInt(0) && (
          <button
            type="button"
            onClick={handleMax}
            className={`bg-surface absolute top-1/2 -translate-y-1/2 transform rounded p-1 text-sm text-secondary opacity-80 duration-300 ease-in-out hover:scale-105 hover:opacity-100 ${
              endAdornment != null ? 'right-9' : 'right-2'
            }`}
          >
            Max
          </button>
        )}
        {endAdornment != null && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-secondary">{endAdornment}</span>
        )}
      </div>
      {error && !bypassMax && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-red-500">{error}</span>
          <Button
            size="xs"
            onClick={handleDismissError}
            variant="default"
          >
            Ignore
          </Button>
        </div>
      )}
    </div>
  );
}
