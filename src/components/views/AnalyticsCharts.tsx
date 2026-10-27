import { useMemo } from 'react';
import { ChartLine } from 'lucide-react';
import { lastDaysRange } from '../../lib/analytics/client';
import { summaryToCharts } from '../../lib/analytics/charts';
import { useAnalyticsSummary } from '../../state/analytics';
import { MetricChartComponent } from '../registry/chart';
import { Card } from '../ui/card';
import { EmptyState, Skeleton } from '../ui/feedback';

const RANGE_DAYS = 14;

/**
 * Campaign charts from the audit API's analytics (GET /v1/analytics/summary). The audit API reports for the
 * whole workspace, so the figures are workspace-wide, not per goal. Nothing here comes from the conversation.
 */
export function AnalyticsCharts() {
  const range = useMemo(() => lastDaysRange(RANGE_DAYS), []);
  const analytics = useAnalyticsSummary(range);
  const charts = useMemo(() => (analytics.status === 'ready' ? summaryToCharts(analytics.summary) : []), [analytics]);

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

  return (
    <>
      <p className="text-caption text-muted-foreground">Last {RANGE_DAYS} days across all campaigns in this workspace.</p>
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
