import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { BsQuestionCircle } from 'react-icons/bs';
import { RiRobot2Line } from 'react-icons/ri';
import type { Address } from 'viem';
import { findAgent } from '@/utils/monarch-agent';
import { TooltipContent } from './tooltip-content';

type AgentIconProps = {
  address: Address;
  width: number;
  height: number;
};

export function AutovaultBadge({ allocators }: { allocators: string[] }) {
  if (!allocators.some((address) => findAgent(address) !== undefined)) return null;

  return (
    <Tooltip content="Autovault">
      <button
        type="button"
        aria-label="Autovault"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex shrink-0 cursor-help rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Badge
          size="sm"
          className="bg-primary/10 text-[var(--color-primary)] dark:bg-primary/15 dark:text-[var(--color-primary)]"
        >
          <RiRobot2Line
            aria-hidden
            className="h-3 w-3"
          />
        </Badge>
      </button>
    </Tooltip>
  );
}

export function AgentIcon({ address, width, height }: AgentIconProps) {
  const agent = findAgent(address);

  if (!agent) {
    return (
      <Tooltip content="Unknown agent">
        <div className="flex items-center justify-center rounded-full bg-hovered/50">
          <BsQuestionCircle
            className="text-secondary"
            style={{ width, height }}
          />
        </div>
      </Tooltip>
    );
  }

  const icon = (
    <>
      <Image
        src={agent.image}
        alt={agent.name}
        width={width}
        height={height}
        className="rounded-full"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div
        className="hidden items-center justify-center"
        style={{ width, height }}
      >
        <BsQuestionCircle
          className="text-secondary"
          style={{ width, height }}
        />
      </div>
    </>
  );

  return (
    <Tooltip
      content={
        <TooltipContent
          title={agent.name}
          detail={agent.strategyDescription}
          icon={icon}
        />
      }
    >
      <div className="flex items-center justify-center rounded-full bg-hovered/50">
        <Image
          src={agent.image}
          alt={agent.name}
          width={width}
          height={height}
          className="rounded-full"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div
          className="hidden items-center justify-center"
          style={{ width, height }}
        >
          <BsQuestionCircle
            className="text-secondary"
            style={{ width, height }}
          />
        </div>
      </div>
    </Tooltip>
  );
}
