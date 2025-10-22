import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { HiQuestionMarkCircle } from 'react-icons/hi';
import { Address } from 'viem';
import { findAgent } from '@/utils/monarch-agent';
import { TooltipContent } from './TooltipContent';

type AgentIconProps = {
  address: Address;
  width: number;
  height: number;
};

export function AgentIcon({ address, width, height }: AgentIconProps) {
  const agent = findAgent(address);

  if (!agent) {
    return (
      <Tooltip content="Unknown agent">
        <div className="flex items-center justify-center rounded-full bg-hovered/50">
          <HiQuestionMarkCircle className="text-secondary" style={{ width, height }} />
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
        <HiQuestionMarkCircle className="text-secondary" style={{ width, height }} />
      </div>
    </>
  );

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
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
          <HiQuestionMarkCircle className="text-secondary" style={{ width, height }} />
        </div>
      </div>
    </Tooltip>
  );
}
