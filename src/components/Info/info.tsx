import { FaRegLightbulb } from 'react-icons/fa';
import { GrStatusGood } from 'react-icons/gr';
import { MdWarning } from 'react-icons/md';
import { MdError } from 'react-icons/md';

const levelToCellColor = (level: string) => {
  switch (level) {
    case 'info':
      return 'bg-blue-200 text-blue-700';
    case 'success':
      return 'bg-green-200 text-green-700';
    case 'warning':
      return 'bg-yellow-200 text-yellow-700';
    case 'alert':
      return 'bg-red-200 text-red-700';
    default:
      return '';
  }
};

const levelToIcon = (level: string) => {
  switch (level) {
    case 'info':
      return <FaRegLightbulb className="mr-2" size={18} />;
    case 'success':
      return <GrStatusGood className="mr-2" size={18} />;
    case 'warning':
      return <MdWarning className="mr-2" size={18} />;
    case 'alert':
      return <MdError className="mr-2" size={18} />;
    default:
      return '';
  }
};

/**
 * based on level, return different color and icon
 * @param description
 * @param level success info warning alert
 */
export function Info({
  description,
  level,
  title,
}: {
  description: string;
  level: string;
  title?: string;
}) {
  return (
    <div className={`flex items-center rounded-sm ${levelToCellColor(level)} p-4 opacity-80`}>
      {levelToIcon(level)}
      <div>
        <h2 className="font-bold">{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
