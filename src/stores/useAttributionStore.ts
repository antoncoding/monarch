import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AttributionTouchpoint = {
  refCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  landingPath: string | null;
  capturedAt: number;
};

type AttributionState = {
  touchpoint: AttributionTouchpoint | null;
  lastSubmittedWallet: string | null;
  lastSubmittedAt: number | null;
};

type AttributionActions = {
  captureFromUrl: (params: Pick<URLSearchParams, 'get'>, pathname: string) => void;
  markSubmittedWallet: (walletAddress: string) => void;
};

type AttributionStore = AttributionState & AttributionActions;

function toNullable(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Persist first-touch attribution parameters so they survive route changes
 * until a wallet connection and first action can be attributed.
 */
export const useAttributionStore = create<AttributionStore>()(
  persist(
    (set) => ({
      touchpoint: null,
      lastSubmittedWallet: null,
      lastSubmittedAt: null,

      captureFromUrl: (params, pathname) =>
        set((state) => {
          const candidate: AttributionTouchpoint = {
            refCode: toNullable(params.get('ref_code')),
            utmSource: toNullable(params.get('utm_source')),
            utmMedium: toNullable(params.get('utm_medium')),
            utmCampaign: toNullable(params.get('utm_campaign')),
            utmContent: toNullable(params.get('utm_content')),
            landingPath: toNullable(pathname),
            capturedAt: Date.now(),
          };

          const hasAttributionValues = Boolean(
            candidate.refCode ?? candidate.utmSource ?? candidate.utmMedium ?? candidate.utmCampaign ?? candidate.utmContent,
          );

          if (!hasAttributionValues && state.touchpoint) {
            return state;
          }

          if (!state.touchpoint) {
            return { touchpoint: candidate };
          }

          // Preserve first-touch semantics by only filling empty fields.
          return {
            touchpoint: {
              refCode: state.touchpoint.refCode ?? candidate.refCode,
              utmSource: state.touchpoint.utmSource ?? candidate.utmSource,
              utmMedium: state.touchpoint.utmMedium ?? candidate.utmMedium,
              utmCampaign: state.touchpoint.utmCampaign ?? candidate.utmCampaign,
              utmContent: state.touchpoint.utmContent ?? candidate.utmContent,
              landingPath: state.touchpoint.landingPath ?? candidate.landingPath,
              capturedAt: state.touchpoint.capturedAt,
            },
          };
        }),

      markSubmittedWallet: (walletAddress) =>
        set({
          lastSubmittedWallet: walletAddress.toLowerCase(),
          lastSubmittedAt: Date.now(),
        }),
    }),
    { name: 'monarch_store_attribution' },
  ),
);
