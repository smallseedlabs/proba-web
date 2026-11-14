import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnalyticsError, type AnalyticsClient, type AnalyticsRange, type AnalyticsSummary, type SeriesPoint } from '../lib/analytics/client';

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function AnalyticsProvider({ client, children }: { client: AnalyticsClient | null; children: ReactNode }) {
  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

export type AnalyticsState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'ready'; summary: AnalyticsSummary }
  | { status: 'error'; kind: AnalyticsError['kind'] };

function mergeSeries(summaries: AnalyticsSummary[]): SeriesPoint[] {
  const byBucketCurrency = new Map<string, SeriesPoint>();
  for (const s of summaries) {
    for (const p of s.series) {
      const key = `${p.bucket}|${p.currency}`;
      const existing = byBucketCurrency.get(key);
      if (existing) {
        existing.impressions += p.impressions;
        existing.clicks += p.clicks;
        existing.spend += p.spend;
        existing.conversions += p.conversions;
      } else {
        byBucketCurrency.set(key, { ...p });
      }
    }
  }
  return [...byBucketCurrency.values()].sort((a, b) => a.bucket.localeCompare(b.bucket) || a.currency.localeCompare(b.currency));
}

/**
 * Loads the audit API's analytics summary for a range; refetches when the range or campaign filter changes.
 * When `campaignIds` is provided:
 * - `[]` (no campaigns launched for this goal yet) returns an empty series immediately (never workspace-wide).
 * - `['c1', 'c2', ...]` queries each campaign and merges their series across all marketing providers.
 * - `undefined` queries workspace-wide summary.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnalyticsSummary(range: AnalyticsRange, campaignIds?: readonly string[]): AnalyticsState {
  const client = useContext(AnalyticsContext);
  const { from, to, granularity, campaignId } = range;
  const campaignKey = campaignIds ? campaignIds.join(',') : campaignId ?? '*';
  const [state, setState] = useState<AnalyticsState>(client ? { status: 'loading' } : { status: 'unconfigured' });

  useEffect(() => {
    if (!client) {
      setState({ status: 'unconfigured' });
      return;
    }
    const ids = campaignIds ?? (campaignId ? [campaignId] : undefined);
    if (ids && ids.length === 0) {
      setState({ status: 'ready', summary: { granularity, series: [] } });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    const promise =
      ids && ids.length > 0
        ? Promise.all(ids.map((id) => client.getSummary({ from, to, granularity, campaignId: id }, controller.signal))).then(
            (summaries): AnalyticsSummary => ({
              granularity,
              series: mergeSeries(summaries),
              freshness: summaries.find((s) => s.freshness?.asOf)?.freshness ?? summaries[0]?.freshness,
            })
          )
        : client.getSummary({ from, to, granularity }, controller.signal);

    promise
      .then((summary) => {
        if (!controller.signal.aborted) setState({ status: 'ready', summary });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', kind: error instanceof AnalyticsError ? error.kind : 'unavailable' });
      });
    return () => controller.abort();
  }, [client, from, to, granularity, campaignKey, campaignIds, campaignId]);

  return state;
}
