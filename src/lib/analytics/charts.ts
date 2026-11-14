import type { AnalyticsRange, AnalyticsSummary, SeriesPoint } from './client';

export interface ChartSpec {
  key: string;
  title: string;
  type: 'area' | 'line' | 'bar';
  data: Array<{ label: string; value: number; timestamp: string }>;
  xAxis: string;
  yAxis: string;
  currency?: string;
}

const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const hourLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/**
 * Generates zero-filled series buckets across `range` when the audit API returns an empty series,
 * so the dashboard still renders a 0-baseline chart for newly launched campaigns.
 */
export function zeroSeriesForRange(range: AnalyticsRange, currency = 'GBP'): SeriesPoint[] {
  const stepMs = range.granularity === 'hour' ? 3_600_000 : 86_400_000;
  const startMs = Date.parse(range.from);
  const endMs = Date.parse(range.to);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const points: SeriesPoint[] = [];
  for (let t = startMs; t < endMs; t += stepMs) {
    points.push({
      bucket: new Date(t).toISOString(),
      currency,
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
    });
  }
  return points;
}

/**
 * Chart specs from the audit API's summary series: daily spend per currency (currencies are never added
 * together) and conversions across the workspace. No data, no chart: an empty series yields no specs.
 */
export function summaryToCharts(summary: AnalyticsSummary): ChartSpec[] {
  if (summary.series.length === 0) return [];
  const label = (bucket: string) => {
    const date = new Date(bucket);
    return Number.isNaN(date.getTime()) ? bucket : (summary.granularity === 'hour' ? hourLabel : dayLabel).format(date);
  };
  const period = summary.granularity === 'hour' ? 'Hour' : 'Day';
  const sorted = [...summary.series].sort((a, b) => a.bucket.localeCompare(b.bucket));

  const conversions = new Map<string, number>();
  const spendByCurrency = new Map<string, Map<string, number>>();
  for (const point of sorted) {
    conversions.set(point.bucket, (conversions.get(point.bucket) ?? 0) + point.conversions);
    const spend = spendByCurrency.get(point.currency) ?? new Map<string, number>();
    spend.set(point.bucket, (spend.get(point.bucket) ?? 0) + point.spend);
    spendByCurrency.set(point.currency, spend);
  }

  const points = (values: Map<string, number>) =>
    [...values].map(([bucket, value]) => ({ label: label(bucket), value, timestamp: bucket }));

  const multiCurrency = spendByCurrency.size > 1;
  const charts: ChartSpec[] = [...spendByCurrency]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, values]) => ({
      key: `spend-${currency}`,
      title: multiCurrency ? `Spend (${currency})` : 'Spend',
      type: 'line',
      data: points(values),
      xAxis: period,
      yAxis: 'Spend',
      currency,
    }));
  charts.push({
    key: 'conversions',
    title: summary.granularity === 'hour' ? 'Hourly conversions' : 'Daily conversions',
    type: 'area',
    data: points(conversions),
    xAxis: period,
    yAxis: 'Conversions',
  });
  return charts;
}
