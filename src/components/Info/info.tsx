import { FaRegLightbulb } from 'react-icons/fa';
import { GrStatusGood } from 'react-icons/gr';
import { MdError } from 'react-icons/md';
import { IoWarningOutline } from 'react-icons/io5';

const levelToCellColor = (level: string) => {
  switch (level) {
    case 'info':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300';
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300';
    case 'alert':
      return 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300';
    default:
      return '';
  }
};

const levelToIcon = (level: string) => {
  switch (level) {
    case 'info':
      return (
        <FaRegLightbulb
          className="mt-0.5 flex-shrink-0"
          size={16}
        />
      );
    case 'success':
      return (
        <GrStatusGood
          className="mt-0.5 flex-shrink-0"
          size={16}
        />
      );
    case 'warning':
      return (
        <IoWarningOutline
          className="mt-0.5 flex-shrink-0"
          size={16}
        />
      );
    case 'alert':
      return (
        <MdError
          className="mt-0.5 flex-shrink-0"
          size={16}
        />
      );
    default:
      return null;
  }
};

/**
 * based on level, return different color and icon
 * @param description
 * @param level success info warning alert
 */
export function Info({ description, level, title }: { description: string; level: string; title?: string }) {
  return (
    <div className={`flex max-w-full items-start gap-2 rounded border border-current/20 ${levelToCellColor(level)} p-3`}>
      {levelToIcon(level)}
      <div className="min-w-0 flex-1">
        {title && <h2 className="font-bold">{title}</h2>}
        <p
          className="text-sm leading-tight hyphens-auto"
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
