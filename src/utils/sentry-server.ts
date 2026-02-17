import 'server-only';
import { reportHandledError } from '@/utils/sentry';

type ApiRouteErrorContext = {
  route: string;
  method: string;
  status?: number;
  extras?: Record<string, unknown>;
};

export const reportApiRouteError = (error: unknown, context: ApiRouteErrorContext): void => {
  reportHandledError(error, {
    scope: 'api_route',
    operation: `${context.method} ${context.route}`,
    level: 'error',
    tags: {
      api_route: context.route,
      api_method: context.method,
      api_status: context.status ?? 500,
    },
    extras: context.extras,
  });
};
