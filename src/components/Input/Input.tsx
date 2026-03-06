import { useCallback, useState, useEffect, useRef } from 'react';

import { formatUnits, parseUnits } from 'viem';
import { hasExcessFractionDigits, isValidDecimalInput, sanitizeDecimalInput, toParseableDecimalInput } from '@/utils/decimal-input';

type InputProps = {
  decimals: number;
  setValue: (value: bigint) => void;
  max?: bigint;
  setError?: ((error: string | null) => void) | React.Dispatch<React.SetStateAction<string | null>>;
  exceedMaxErrMessage?: string;
  allowExceedMax?: boolean; // set false to block setValue when the input exceeds max
  onMaxClick?: () => void;
  value?: bigint;
  error?: string | null; // optional error message to render below the input
  endAdornment?: React.ReactNode;
  inputClassName?: string;
  debounceSetValueMs?: number;
};

const formatInputAmount = (value: bigint, decimals: number): string => {
  const formatted = formatUnits(value, decimals);
  if (!formatted.includes('.')) return formatted;
  const trimmed = formatted.replace(/\.?0+$/, '');
  return trimmed.length > 0 ? trimmed : '0';
};

export default function Input({
  decimals,
  max,
  setValue,
  setError,
  exceedMaxErrMessage,
  allowExceedMax = true,
  onMaxClick,
  value,
  error,
  endAdornment,
  inputClassName,
  debounceSetValueMs = 0,
}: InputProps): JSX.Element {
  // State for the input text
  const [inputAmount, setInputAmount] = useState<string>(value ? formatInputAmount(value, decimals) : '0');
  const [isFocused, setIsFocused] = useState(false);
  const setValueDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSetValueRef = useRef<bigint | null>(null);
  const setValueRef = useRef(setValue);

  const clearSetValueDebounce = useCallback(() => {
    if (setValueDebounceTimerRef.current == null) return;
    clearTimeout(setValueDebounceTimerRef.current);
    setValueDebounceTimerRef.current = null;
  }, []);

  const flushPendingSetValue = useCallback(() => {
    clearSetValueDebounce();
    const pendingValue = pendingSetValueRef.current;
    if (pendingValue == null) return;
    pendingSetValueRef.current = null;
    setValueRef.current(pendingValue);
  }, [clearSetValueDebounce]);

  const scheduleSetValue = useCallback(
    (nextValue: bigint) => {
      pendingSetValueRef.current = nextValue;
      clearSetValueDebounce();

      if (debounceSetValueMs <= 0) {
        flushPendingSetValue();
        return;
      }

      setValueDebounceTimerRef.current = setTimeout(() => {
        flushPendingSetValue();
      }, debounceSetValueMs);
    },
    [clearSetValueDebounce, debounceSetValueMs, flushPendingSetValue],
  );

  // Update input text when value prop changes
  useEffect(() => {
    if (isFocused) return;
    if (value !== undefined) {
      setInputAmount(formatInputAmount(value, decimals));
    }
  }, [value, decimals, isFocused]);

  useEffect(() => {
    setValueRef.current = setValue;
  }, [setValue]);

  useEffect(
    () => () => {
      clearSetValueDebounce();
    },
    [clearSetValueDebounce],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // update the shown input text regardless
      const normalizedInput = sanitizeDecimalInput(e.target.value);
      if (!isValidDecimalInput(normalizedInput)) {
        return;
      }
      if (hasExcessFractionDigits(normalizedInput, decimals)) {
        return;
      }
      setInputAmount(normalizedInput);

      const parseableInput = toParseableDecimalInput(normalizedInput);
      if (!parseableInput) {
        scheduleSetValue(BigInt(0));
        if (setError) setError(null);
        return;
      }

      try {
        const inputBigInt = parseUnits(parseableInput, decimals);

        if (max !== undefined && inputBigInt > max) {
          if (setError) setError(exceedMaxErrMessage ?? 'Input exceeds max');
          if (allowExceedMax) {
            scheduleSetValue(inputBigInt);
          }
          return;
        }

        scheduleSetValue(inputBigInt);
        if (setError) setError(null);
      } catch {
        if (setError) setError('Invalid input');
      }
    },
    [decimals, setError, setInputAmount, max, exceedMaxErrMessage, allowExceedMax, scheduleSetValue],
  );

  // if max is clicked, set the input to the max value
  const handleMax = useCallback(() => {
    clearSetValueDebounce();
    pendingSetValueRef.current = null;
    if (max) {
      setValue(max);
      // set readable input
      setInputAmount(formatInputAmount(max, decimals));
    }
    if (onMaxClick) onMaxClick();
  }, [clearSetValueDebounce, max, decimals, setInputAmount, setValue, onMaxClick]);

  const handleBlur = useCallback(() => {
    flushPendingSetValue();
    setIsFocused(false);
    if (value !== undefined) {
      setInputAmount(formatInputAmount(value, decimals));
    }
  }, [flushPendingSetValue, value, decimals]);

  return (
    <div className="flex-grow">
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          lang="en-US"
          value={inputAmount}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
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
      {error && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-red-500">{error}</span>
        </div>
      )}
    </div>
  );
}
