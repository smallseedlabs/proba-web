import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnalyticsError, type AnalyticsClient, type AnalyticsRange, type AnalyticsSummary } from '../lib/analytics/client';

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function AnalyticsProvider({ client, children }: { client: AnalyticsClient | null; children: ReactNode }) {
  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

export type AnalyticsState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'ready'; summary: AnalyticsSummary }
  | { status: 'error'; kind: AnalyticsError['kind'] };

/** Loads the audit API's analytics summary for a range; refetches when the range changes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnalyticsSummary(range: AnalyticsRange): AnalyticsState {
  const client = useContext(AnalyticsContext);
  const { from, to, granularity } = range;
  const [state, setState] = useState<AnalyticsState>(client ? { status: 'loading' } : { status: 'unconfigured' });

  useEffect(() => {
    if (!client) {
      setState({ status: 'unconfigured' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    client
      .getSummary({ from, to, granularity }, controller.signal)
      .then((summary) => {
        if (!controller.signal.aborted) setState({ status: 'ready', summary });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', kind: error instanceof AnalyticsError ? error.kind : 'unavailable' });
      });
    return () => controller.abort();
  }, [client, from, to, granularity]);

  return state;
}
