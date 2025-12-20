import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/components';

const inputVariants = cva(
  'flex w-full rounded bg-surface px-3 py-2 text-sm text-primary placeholder:text-secondary outline-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 font-zen transition-all',
  {
    variants: {
      variant: {
        default: 'border border-border',
        filled: 'bg-hovered border-0',
      },
      inputSize: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'filled',
      inputSize: 'md',
    },
  },
);

type InputRootProps = {
  label?: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  classNames?: {
    base?: string;
    label?: string;
    inputWrapper?: string;
    input?: string;
    description?: string;
    errorMessage?: string;
  };
  onValueChange?: (value: string) => void;
};

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  Omit<VariantProps<typeof inputVariants>, 'inputSize'> &
  InputRootProps & {
    size?: 'sm' | 'md' | 'lg';
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = 'text',
      label,
      description,
      errorMessage,
      isInvalid,
      startContent,
      endContent,
      classNames,
      onValueChange,
      onChange,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.(e.target.value);
      onChange?.(e);
    };

    return (
      <div className={cn('flex w-full flex-col gap-1.5', classNames?.base)}>
        {label && (
          <label htmlFor={props.id} className={cn('text-xs font-medium text-secondary font-zen', classNames?.label)}>
            {label}
          </label>
        )}
        <div
          className={cn(
            'relative flex items-center',
            classNames?.inputWrapper,
          )}
        >
          {startContent && <div className="absolute left-3 flex items-center">{startContent}</div>}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize: size }),
              isInvalid && 'border-red-500 focus-visible:ring-red-500/20',
              startContent && 'pl-10',
              endContent && 'pr-10',
              className,
              classNames?.input,
            )}
            ref={ref}
            {...props}
            onChange={handleChange}
          />
          {endContent && <div className="absolute right-3 flex items-center">{endContent}</div>}
        </div>
        {description && !isInvalid && (
          <p className={cn('text-xs text-secondary font-zen', classNames?.description)}>{description}</p>
        )}
        {isInvalid && errorMessage && (
          <p className={cn('text-xs text-red-500 font-zen', classNames?.errorMessage)}>{errorMessage}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
