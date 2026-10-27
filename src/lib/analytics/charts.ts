import type { AnalyticsSummary } from './client';

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
