import { VeloraApiError } from '@/features/swap/api/velora';

const normalizeMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

const extractImpactValue = (error: unknown): string | null => {
  if (!(error instanceof VeloraApiError) || !error.details || typeof error.details !== 'object') {
    return null;
  }

  const details = error.details as Record<string, unknown>;
  return typeof details.value === 'string' ? details.value : null;
};

const isPairValidationError = (message: string): boolean =>
  message.includes('validation failed') && (message.includes('srctoken') || message.includes('desttoken'));

export const toUserFacingVeloraQuoteError = ({ error, action }: { error: unknown; action: 'leverage' | 'deleverage' }): string => {
  const rawMessage = normalizeMessage(error);
  const message = rawMessage.toLowerCase();

  if (message.includes('no routes found with enough liquidity')) {
    return 'No swap route is available for this size right now. Try a smaller amount or a different market.';
  }

  if (message.includes('estimated_loss_greater_than_max_impact') || message.includes('max impact')) {
    const impactValue = extractImpactValue(error);
    return impactValue
      ? `This swap would lose too much value right now (~${impactValue} impact). Try a smaller amount or a different market.`
      : 'This swap is too expensive right now. Try a smaller amount or a different market.';
  }

  if (message.includes('failed to size velora sell route for target leverage')) {
    return 'Could not find a swap route that reaches this size. Try a smaller amount or a lower multiplier.';
  }

  if (isPairValidationError(message)) {
    return 'This pair is not available through the swap router right now.';
  }

  if (message.includes('failed to fetch velora api response')) {
    return 'Could not reach the swap router. Please try again.';
  }

  if (!rawMessage) {
    return action === 'leverage' ? 'Failed to quote swap-backed leverage route.' : 'Failed to quote swap-backed deleverage route.';
  }

  return rawMessage;
};
