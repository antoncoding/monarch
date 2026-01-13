'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/utils/components';
import { Button, buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <div className="[&_table]:border-collapse [&_table]:font-zen [&_thead]:!bg-transparent [&_thead]:!text-xs [&_thead]:!font-normal [&_thead]:!text-primary [&_thead_th]:!p-0 [&_thead_th]:!text-xs [&_tbody]:!bg-transparent [&_tbody]:!border-none [&_tbody_td]:!p-0 [&_tbody_tr]:!border-l-0 [&_tbody_tr]:!border-none [&_tbody_tr:hover]:!bg-transparent [&_tbody_tr:hover]:!border-l-0 [&_tbody_tr:hover]:!border-none">
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          'bg-surface group/calendar p-2 font-zen [--cell-size:1.75rem]',
          'rtl:**:[.rdp-button_next>svg]:rotate-180',
          'rtl:**:[.rdp-button_previous>svg]:rotate-180',
          className,
        )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-2 md:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-2', defaultClassNames.month),
        nav: cn('absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1', defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-[var(--cell-size)] w-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-[var(--cell-size)] w-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-[var(--cell-size)] w-full items-center justify-center gap-1.5 text-sm font-normal',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative border border-border rounded-sm shadow-sm has-focus:border-primary has-focus:ring-primary/50 has-focus:ring-[3px]',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn('absolute inset-0 opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'select-none font-normal text-primary',
          captionLayout === 'label'
            ? 'text-xs'
            : 'flex h-7 items-center gap-1 rounded-sm pl-2 pr-1 text-xs [&>svg]:size-3 [&>svg]:text-secondary',
          defaultClassNames.caption_label,
        ),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn('text-secondary flex-1 select-none rounded-sm text-[0.7rem] font-normal', defaultClassNames.weekday),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        week_number_header: cn('w-[var(--cell-size)] select-none', defaultClassNames.week_number_header),
        week_number: cn('text-secondary select-none text-[0.8rem]', defaultClassNames.week_number),
        day: cn(
          'group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-sm [&:last-child[data-selected=true]_button]:rounded-r-sm',
          defaultClassNames.day,
        ),
        range_start: cn('bg-hovered rounded-l-sm', defaultClassNames.range_start),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn('bg-hovered rounded-r-sm', defaultClassNames.range_end),
        today: cn('bg-hovered text-primary rounded-sm data-[selected=true]:rounded-none', defaultClassNames.today),
        outside: cn('text-secondary aria-selected:text-secondary', defaultClassNames.outside),
        disabled: cn('text-secondary opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(rootClassName)} {...rootProps} />;
        },
        Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) => {
          if (orientation === 'left') {
            return <ChevronLeftIcon className={cn('size-3.5', chevronClassName)} {...chevronProps} />;
          }

          if (orientation === 'right') {
            return <ChevronRightIcon className={cn('size-3.5', chevronClassName)} {...chevronProps} />;
          }

          return <ChevronDownIcon className={cn('size-3.5', chevronClassName)} {...chevronProps} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...weekProps }) => {
          return (
            <td {...weekProps}>
              <div className="flex size-[var(--cell-size)] items-center justify-center text-center">{children}</div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
    </div>
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-hovered data-[range-middle=true]:text-primary data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-primary group-data-[focused=true]/day:ring-primary/50',
        'flex aspect-square !h-[var(--cell-size)] !w-[var(--cell-size)] !min-w-[var(--cell-size)] flex-col gap-0 font-normal leading-none text-xs group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] !p-0',
        'data-[range-end=true]:rounded-sm data-[range-end=true]:rounded-r-sm data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-sm data-[range-start=true]:rounded-l-sm',
        '[&_svg]:!size-3',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
