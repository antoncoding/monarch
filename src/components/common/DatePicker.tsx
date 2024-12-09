import { DatePicker, DatePickerProps } from '@nextui-org/react';

function StyledDatePicker(props: DatePickerProps) {
  const stylesDatePicker = {
    selectorButton: ['hover:text-primary'],
  };

  const stylesDateInput = {
    inputWrapper: ['bg-surface', 'rounded-sm', 'w-64', 'h-14'],
  };

  return (
    <DatePicker
      label={props.label}
      variant={props.variant}
      value={props.value}
      classNames={stylesDatePicker}
      dateInputClassNames={stylesDateInput}
      minValue={props.minValue}
      maxValue={props.maxValue}
      onChange={props.onChange}
    />
  );
}

export default StyledDatePicker;
