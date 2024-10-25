'use client';

import { Checkbox } from '@nextui-org/checkbox';
import { Tooltip } from '@nextui-org/tooltip';
import { BsQuestionCircle } from 'react-icons/bs';

type CheckFilterProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
};

export default function CheckFilter({ label, checked, onChange, tooltip }: CheckFilterProps) {
  return (
    <Checkbox
      classNames={{
        base: 'inline-flex bg-secondary items-center cursor-pointer rounded-sm px-2 h-14 min-w-48',
      }}
      isSelected={checked}
      onValueChange={onChange}
      radius="sm"
      size="sm"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-default-500"> {label} </span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <div>
              <BsQuestionCircle className="text-default-500" />
            </div>
          </Tooltip>
        )}
      </div>
    </Checkbox>
  );
}
