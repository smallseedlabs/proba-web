import { describe, it, expect, vi } from 'vitest';
import { summaryToCharts } from './charts';
import { HttpAnalyticsClient, lastDaysRange, type AnalyticsSummary } from './client';

const point = (bucket: string, currency: string, spend: number, conversions: number) => ({
  bucket,
  currency,
  impressions: 1000,
  clicks: 50,
  spend,
  conversions,
});

const SUMMARY = {
  workspaceId: 'w',
  from: '2026-10-25T00:00:00.000Z',
  to: '2026-10-27T00:00:00.000Z',
  granularity: 'day',
  totals: [],
  series: [point('2026-10-26T00:00:00.000Z', 'USD', 30, 3), point('2026-10-25T00:00:00.000Z', 'USD', 20, 2)],
  freshness: { asOf: '2026-10-26T12:00:00.000Z', rollupsComputedAt: null, observationsFetchedAt: null },
};

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('lastDaysRange', () => {
  it('covers the last N whole UTC days including today', () => {
    expect(lastDaysRange(14, new Date('2026-10-27T22:20:00Z'))).toEqual({
      from: '2026-10-14T00:00:00.000Z',
      to: '2026-10-28T00:00:00.000Z',
      granularity: 'day',
    });
  });
});

describe('HttpAnalyticsClient', () => {
  const range = { from: '2026-10-25T00:00:00.000Z', to: '2026-10-27T00:00:00.000Z', granularity: 'day' as const };

  it('reads GET /v1/analytics/summary with the Firebase ID token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, SUMMARY));
    const client = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken: async () => 'id-token', fetchImpl });
    const summary = await client.getSummary(range);

    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://audit.test/v1/analytics/summary');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ from: range.from, to: range.to, granularity: 'day' });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer id-token' });
    expect(summary.series).toHaveLength(2);
  });

  it('refreshes the token once after a 401 and retries', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(200, SUMMARY));
    const getToken = vi.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    const client = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken, fetchImpl });
    await client.getSummary(range);
    expect(getToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [500, 'unavailable'],
  ])('maps a %i response to %s', async (status, kind) => {
    const client = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken: async () => 't', fetchImpl: vi.fn().mockResolvedValue(json(status, {})) });
    await expect(client.getSummary(range)).rejects.toMatchObject({ kind });
  });

  it('maps network failures, missing tokens and unexpected bodies to errors', async () => {
    const offline = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken: async () => 't', fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) });
    await expect(offline.getSummary(range)).rejects.toMatchObject({ kind: 'unavailable' });

    const signedOut = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken: async () => Promise.reject(new Error('no user')), fetchImpl: vi.fn() });
    await expect(signedOut.getSummary(range)).rejects.toMatchObject({ kind: 'unauthenticated' });

    const odd = new HttpAnalyticsClient({ baseUrl: 'http://audit.test', getToken: async () => 't', fetchImpl: vi.fn().mockResolvedValue(json(200, { series: 'nope' })) });
    await expect(odd.getSummary(range)).rejects.toMatchObject({ kind: 'bad_response' });
  });
});

describe('summaryToCharts', () => {
  const summary = SUMMARY as unknown as AnalyticsSummary;

  it('turns the series into spend and conversion charts, oldest first', () => {
    const [spend, conversions] = summaryToCharts(summary);
    expect(spend).toMatchObject({ key: 'spend-USD', title: 'Spend', currency: 'USD', xAxis: 'Day' });
    expect(spend.data.map((d) => [d.label, d.value])).toEqual([['25 Oct', 20], ['26 Oct', 30]]);
    expect(conversions).toMatchObject({ key: 'conversions', title: 'Daily conversions', yAxis: 'Conversions' });
    expect(conversions.data.map((d) => d.value)).toEqual([2, 3]);
  });

  it('never adds currencies together', () => {
    const multi = {
      ...summary,
      series: [point('2026-10-25T00:00:00.000Z', 'USD', 20, 2), point('2026-10-25T00:00:00.000Z', 'EUR', 5, 1)],
    } as AnalyticsSummary;
    const charts = summaryToCharts(multi);
    expect(charts.map((c) => c.title)).toEqual(['Spend (EUR)', 'Spend (USD)', 'Daily conversions']);
    expect(charts[0].data[0].value).toBe(5);
    expect(charts[1].data[0].value).toBe(20);
    expect(charts[2].data[0].value).toBe(3); // conversions are counts: summed across currencies
  });

  it('yields no charts for an empty series (no invented data)', () => {
    expect(summaryToCharts({ ...summary, series: [] })).toEqual([]);
  });
});
