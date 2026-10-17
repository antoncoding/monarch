import type { ReactNode } from 'react';
import { HelpTooltipIcon } from '@/components/shared/help-tooltip-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { type ExecutableSwapQuote, isPendlePtLeveragePlan, isPendlePtSwapQuote } from '@/hooks/leverage/pendle';
import type { LeverageRoute } from '@/hooks/leverage/types';

type RouteDisclosureProps = {
  action: 'leverage' | 'deleverage';
  quote: ExecutableSwapQuote | null;
  route: LeverageRoute | null;
};

const row = (label: ReactNode, value: string): ReactNode => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-secondary">{label}</span>
    <span className="text-right">{value}</span>
  </div>
);

export function RouteDisclosure({ action, quote, route }: RouteDisclosureProps): ReactNode {
  if (!route) return null;

  let execution: string;
  let source: string;
  let detail: string;

  if (route.kind === 'erc4626') {
    execution = 'ERC-4626 vault';
    source = 'Onchain preview';
    detail = 'The vault conversion is previewed onchain before the transaction is built.';
  } else if (route.conversion === 'pendle-pt') {
    if (!quote) return null;
    const legs = isPendlePtLeveragePlan(quote)
      ? [quote.initialCapital, quote.flash].filter((leg) => leg !== null)
      : isPendlePtSwapQuote(quote)
        ? [quote]
        : [];
    if (legs.length === 0) return null;

    const usesExternalSwap = legs.some((leg) => leg.externalSwap !== null);
    execution = usesExternalSwap ? (action === 'leverage' ? 'ParaSwap → Pendle Router' : 'Pendle Router → ParaSwap') : 'Pendle Router';
    source = usesExternalSwap ? 'Velora + Pendle API' : 'Pendle API';
    detail =
      'Pendle API supplies route calldata. Monarch verifies its router, market, tokens, receiver, amounts, and slippage before execution.';
  } else {
    execution = 'ParaSwap';
    source = 'Velora';
    detail = 'Velora supplies the swap route. Monarch verifies its execution target, tokens, amounts, and slippage before execution.';
  }

  return (
    <>
      {row('Execution Route', execution)}
      {row(
        <span className="inline-flex items-center gap-0.5">
          Route Data
          <HelpTooltipIcon
            content={
              <TooltipContent
                title="Route data"
                detail={detail}
              />
            }
            ariaLabel="Explain route data source"
            className="h-auto w-auto"
          />
        </span>,
        source,
      )}
    </>
  );
}
