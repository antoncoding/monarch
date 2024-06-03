import { FaRegLightbulb } from 'react-icons/fa';
import { GrStatusGood } from 'react-icons/gr';
import { IoWarning } from 'react-icons/io5';
import { MdError } from 'react-icons/md';

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
  let content;
  switch (level) {
    case 'info':
      content = (
        <div className="flex items-center rounded-sm bg-blue-200 p-4 text-blue-700 opacity-80">
          <FaRegLightbulb className="mr-2" size={18} />
          <div>
            <h2 className="font-bold">{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      );
      break;
    case 'success':
      content = (
        <div className="flex items-center rounded-sm bg-green-200 p-4 text-green-700 opacity-80">
          <GrStatusGood className="mr-2" size={18} />
          <div>
            <h2 className="font-bold">{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      );
      break;
    case 'warning':
      content = (
        <div className="flex items-center rounded-sm bg-yellow-200 p-4 text-yellow-700 opacity-80">
          <IoWarning className="m-2" size={18} />
          <div>
            <h2 className="font-bold">{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      );
      break;
    case 'alert':
      content = (
        <div className="flex items-center rounded-sm bg-red-200 p-4 text-red-700 opacity-80">
          <MdError className="mr-2" size={18} />
          <div>
            <h2 className="font-bold">{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      );
      break;
    default:
      content = <div>{description}</div>;
  }

  return content;
}
