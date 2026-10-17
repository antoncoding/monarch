import Image, { type ImageProps } from 'next/image';
import type { ReactNode } from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Tooltip } from '@/components/ui/tooltip';
import { type ExecutableSwapQuote, isPendlePtLeveragePlan, isPendlePtSwapQuote } from '@/hooks/leverage/pendle';
import type { LeverageRoute } from '@/hooks/leverage/types';
import pendleLogo from '@/imgs/oracles/pendle.png';
import veloraLogo from '@/imgs/providers/velora.svg';

type RouteDisclosureProps = {
  action: 'leverage' | 'deleverage';
  quote: ExecutableSwapQuote | null;
  route: LeverageRoute | null;
};

type RouteProvider = 'pendle' | 'velora';

const PROVIDERS: Record<RouteProvider, { detail: string; logo: ImageProps['src']; name: string }> = {
  pendle: {
    detail: 'Route calldata from Pendle API, verified against the canonical Pendle contracts.',
    logo: pendleLogo,
    name: 'Pendle',
  },
  velora: {
    detail: 'Route data from Velora, executed through the canonical ParaSwap adapter.',
    logo: veloraLogo,
    name: 'Velora',
  },
};

export function RouteDisclosure({ action, quote, route }: RouteDisclosureProps): ReactNode {
  if (!route || route.kind !== 'swap') return null;

  let providers: RouteProvider[];
  if (route.conversion === 'pendle-pt') {
    if (!quote) return null;
    const legs = isPendlePtLeveragePlan(quote)
      ? [quote.initialCapital, quote.flash].filter((leg) => leg !== null)
      : isPendlePtSwapQuote(quote)
        ? [quote]
        : [];
    if (legs.length === 0) return null;

    const usesExternalSwap = legs.some((leg) => leg.externalSwap !== null);
    providers = usesExternalSwap ? (action === 'leverage' ? ['velora', 'pendle'] : ['pendle', 'velora']) : ['pendle'];
  } else {
    providers = ['velora'];
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary">Route</span>
      <span
        className="inline-flex items-center gap-1"
        role="group"
        aria-label={`Route: ${providers.map((provider) => PROVIDERS[provider].name).join(' to ')}`}
      >
        {providers.map((provider, index) => {
          const item = PROVIDERS[provider];
          return (
            <span
              key={provider}
              className="contents"
            >
              {index > 0 && (
                <ArrowRightIcon
                  className="h-3 w-3 text-secondary"
                  aria-hidden
                />
              )}
              <Tooltip
                content={
                  <span className="block max-w-56 text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span className="mt-1 block text-secondary">{item.detail}</span>
                  </span>
                }
              >
                <button
                  type="button"
                  aria-label={`${item.name} route provider`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                >
                  <Image
                    src={item.logo}
                    alt=""
                    width={20}
                    height={20}
                    className={provider === 'pendle' ? 'rounded-full' : 'rounded-sm'}
                  />
                </button>
              </Tooltip>
            </span>
          );
        })}
      </span>
    </div>
  );
}
