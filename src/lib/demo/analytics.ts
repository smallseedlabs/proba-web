import type { AnalyticsClient, AnalyticsRange, AnalyticsSummary } from '../analytics/client';

const CONVERSIONS = [6, 9, 8, 12, 11, 14, 13, 17, 15, 19, 18, 22, 21, 28];

/**
 * Development-only stand-in for the audit API's analytics, so the demo build shows charts without a
 * backend. Only bundled when VITE_DEMO_MODE=true.
 */
export class DemoAnalyticsClient implements AnalyticsClient {
  async getSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
    const day = 86_400_000;
    const start = new Date(range.from).getTime();
    const count = Math.max(1, Math.round((new Date(range.to).getTime() - start) / day));
    const series = Array.from({ length: count }, (_, i) => {
      const conversions = CONVERSIONS[Math.max(0, CONVERSIONS.length - count) + i] ?? CONVERSIONS[CONVERSIONS.length - 1];
      return {
        bucket: new Date(start + i * day).toISOString(),
        currency: 'USD',
        impressions: conversions * 900,
        clicks: conversions * 24,
        spend: Math.round(conversions * 9.2),
        conversions,
      };
    });
    return { granularity: 'day', series, freshness: { asOf: new Date().toISOString() } };
  }
}
