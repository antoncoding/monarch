import { Checkbox } from "@nextui-org/checkbox";
import { Tooltip } from "@nextui-org/tooltip";
import { BsQuestionCircle } from "react-icons/bs";

type CheckFilterProps= {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
};


export default function CheckFilter({ label, checked, onChange, tooltip }: CheckFilterProps) {
  return (
    <Checkbox
      classNames={{
        base: 'inline-flex bg-secondary items-center cursor-pointer rounded-sm m-1 p-3',
      }}
      isSelected={checked}
      onValueChange={onChange}
      size="sm"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-default-500"> {label} </span>
        {tooltip && <Tooltip content={tooltip}>
          <div>
            <BsQuestionCircle className="text-default-500" />
          </div>
        </Tooltip>}
      </div>
    </Checkbox>
  );
}