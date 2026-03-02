import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import {
  MAX_SLIPPAGE_PERCENT,
  MIN_SLIPPAGE_PERCENT,
  clampSlippagePercent,
} from '@/features/swap/constants';
import {
  isValidDecimalInput,
  sanitizeDecimalInput,
  toParseableDecimalInput,
} from '@/utils/decimal-input';
import { formatSlippagePercent } from '../utils/quote-preview';

type SlippageInlineEditorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};

const clampToBounds = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const formatInputValue = (value: number, min: number, max: number): string => {
  const bounded = clampToBounds(clampSlippagePercent(value), min, max);
  return formatSlippagePercent(bounded);
};

export function SlippageInlineEditor({
  value,
  onChange,
  min = MIN_SLIPPAGE_PERCENT,
  max = MAX_SLIPPAGE_PERCENT,
  disabled = false,
}: SlippageInlineEditorProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string>(formatInputValue(value, min, max));
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (isEditing) return;
    setDraftValue(formatInputValue(value, min, max));
  }, [value, min, max, isEditing]);

  const handleBeginEdit = useCallback(() => {
    if (disabled) return;
    skipBlurCommitRef.current = false;
    setDraftValue(formatInputValue(value, min, max));
    setIsEditing(true);
  }, [value, min, max, disabled]);

  const handleCancel = useCallback(() => {
    setDraftValue(formatInputValue(value, min, max));
    setIsEditing(false);
  }, [value, min, max]);

  const handleCommit = useCallback(() => {
    const parseableInput = toParseableDecimalInput(draftValue);
    if (!parseableInput) {
      setDraftValue(formatInputValue(value, min, max));
      setIsEditing(false);
      return;
    }

    const parsed = Number(parseableInput);
    if (!Number.isFinite(parsed)) {
      setDraftValue(formatInputValue(value, min, max));
      setIsEditing(false);
      return;
    }

    const bounded = clampToBounds(clampSlippagePercent(parsed), min, max);
    onChange(bounded);
    setDraftValue(formatInputValue(bounded, min, max));
    skipBlurCommitRef.current = false;
    setIsEditing(false);
  }, [draftValue, value, min, max, onChange]);

  const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedInput = sanitizeDecimalInput(event.target.value);
    if (!isValidDecimalInput(normalizedInput)) {
      return;
    }
    setDraftValue(normalizedInput);
  }, []);

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          lang="en-US"
          autoFocus
          value={draftValue}
          onChange={handleDraftChange}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            handleCommit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleCommit();
              return;
            }
            if (event.key === 'Escape') {
              skipBlurCommitRef.current = true;
              handleCancel();
            }
          }}
          className="h-6 w-14 rounded-sm bg-surface px-1.5 text-right text-[11px] tabular-nums focus:border-primary focus:outline-none"
          aria-label="Slippage percentage"
          disabled={disabled}
        />
        <span className="text-xs text-secondary">%</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{formatInputValue(value, min, max)}%</span>
      <button
        type="button"
        onClick={handleBeginEdit}
        className="inline-flex h-4 w-4 items-center justify-center rounded text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Edit slippage"
        disabled={disabled}
      >
        <Pencil1Icon className="h-3 w-3" />
      </button>
    </span>
  );
}
