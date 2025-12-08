import { DatePicker, type DatePickerProps } from '@heroui/react';

function StyledDatePicker(props: DatePickerProps) {
  const classNames = {
    base: 'h-[88px]', // Reserve space for error message
    inputWrapper: ['bg-surface', 'rounded-sm', 'w-64', 'h-14'],
    label: 'text-xs text-gray-500',
    input: 'text-sm',
    errorMessage: 'text-xs text-red-500 absolute bottom-0 left-0',
    selectorButton: ['hover:text-primary'],
  };

  return (
    <DatePicker
      label={props.label}
      variant={props.variant}
      value={props.value}
      classNames={classNames}
      minValue={props.minValue}
      maxValue={props.maxValue}
      onChange={props.onChange}
      isInvalid={props.isInvalid}
      errorMessage={props.errorMessage}
      granularity={props.granularity}
    />
  );
}

export default StyledDatePicker;
