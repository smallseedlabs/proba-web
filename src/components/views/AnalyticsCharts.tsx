import { useMemo } from 'react';
import { ChartLine } from 'lucide-react';
import { lastDaysRange } from '../../lib/analytics/client';
import { summaryToCharts, zeroSeriesForRange } from '../../lib/analytics/charts';
import { useAnalyticsSummary } from '../../state/analytics';
import { MetricChartComponent } from '../registry/chart';
import { Card } from '../ui/card';
import { EmptyState, Skeleton } from '../ui/feedback';

const RANGE_DAYS = 14;

/**
 * Campaign charts from the audit API's analytics (GET /v1/analytics/summary). When `campaignIds` are
 * provided for a specific Proba goal, only those campaigns' observations across all connected
 * marketing providers are queried and merged. Nothing here comes from the conversation.
 */
export function AnalyticsCharts({
  defaultCurrency = 'GBP',
  campaignIds,
  platforms,
}: {
  defaultCurrency?: string;
  campaignIds?: readonly string[];
  platforms?: readonly string[];
} = {}) {
  const range = useMemo(() => lastDaysRange(RANGE_DAYS), []);
  const analytics = useAnalyticsSummary(range, campaignIds);
  const { charts, isZeroBaseline } = useMemo(() => {
    if (analytics.status !== 'ready') return { charts: [], isZeroBaseline: false };
    if (analytics.summary.series.length > 0) {
      return { charts: summaryToCharts(analytics.summary), isZeroBaseline: false };
    }
    const zeroSummary = {
      ...analytics.summary,
      series: zeroSeriesForRange(range, defaultCurrency),
    };
    return { charts: summaryToCharts(zeroSummary), isZeroBaseline: true };
  }, [analytics, range, defaultCurrency]);

  if (analytics.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Loading charts">
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (analytics.status !== 'ready' || charts.length === 0) {
    const [title, description] =
      analytics.status === 'unconfigured'
        ? ['Charts are not connected', 'Performance charts need the audit service, which is not configured for this deployment.']
        : analytics.status === 'error' && analytics.kind === 'forbidden'
          ? ['Charts are not available to your account', 'Ask a workspace administrator for access to performance analytics.']
          : analytics.status === 'error'
            ? ['Charts are temporarily unavailable', 'We could not load performance analytics. Try again shortly.']
            : ['No performance data yet', 'Results will appear here as soon as campaigns report spend and conversions.'];
    return (
      <Card>
        <EmptyState icon={<ChartLine className="h-6 w-6" />} title={title} description={description} />
      </Card>
    );
  }

  const providerSummary =
    platforms && platforms.length > 0
      ? `for this Proba campaign (${[...new Set(platforms)].join(', ')})`
      : campaignIds !== undefined
        ? 'for this Proba campaign'
        : 'across all campaigns in this workspace';

  return (
    <>
      <p className="text-caption text-muted-foreground">
        Last {RANGE_DAYS} days {providerSummary}.
        {isZeroBaseline ? ' No performance data yet — showing 0 baseline until observations are synced.' : ''}
      </p>
      {charts.map((chart) => (
        <MetricChartComponent
          key={chart.key}
          ui={{
            component: 'metric_chart',
            version: '1.0.0',
            props: { title: chart.title, type: chart.type, data: chart.data, xAxis: chart.xAxis, yAxis: chart.yAxis, currency: chart.currency },
          }}
          fallbackText={chart.title}
        />
      ))}
    </>
  );
}
