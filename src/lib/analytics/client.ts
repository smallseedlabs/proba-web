import { z } from 'zod';

/** One bucket of the audit API's GET /v1/analytics/summary series (one row per bucket and currency). */
const seriesPointSchema = z.object({
  bucket: z.string(),
  currency: z.string(),
  impressions: z.number(),
  clicks: z.number(),
  spend: z.number(),
  conversions: z.number(),
});

const summarySchema = z.object({
  granularity: z.enum(['hour', 'day']),
  series: z.array(seriesPointSchema),
  freshness: z
    .object({ asOf: z.string().nullable() })
    .passthrough()
    .optional(),
});

export type SeriesPoint = z.infer<typeof seriesPointSchema>;
export type AnalyticsSummary = z.infer<typeof summarySchema>;

export interface AnalyticsRange {
  /** ISO 8601 UTC (ending in Z), on a day boundary for daily granularity. */
  from: string;
  to: string;
  granularity: 'hour' | 'day';
}

export type AnalyticsErrorKind = 'forbidden' | 'unauthenticated' | 'unavailable' | 'bad_response';

export class AnalyticsError extends Error {
  constructor(
    public readonly kind: AnalyticsErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

/** Where campaign chart data comes from: the audit API's analytics, never the conversation. */
export interface AnalyticsClient {
  getSummary(range: AnalyticsRange, signal?: AbortSignal): Promise<AnalyticsSummary>;
}

/** The last `days` whole UTC days including today, as a daily range. */
export function lastDaysRange(days: number, now: Date = new Date()): AnalyticsRange {
  const day = 86_400_000;
  const startOfToday = Math.floor(now.getTime() / day) * day;
  return {
    from: new Date(startOfToday - (days - 1) * day).toISOString(),
    to: new Date(startOfToday + day).toISOString(),
    granularity: 'day',
  };
}

export interface HttpAnalyticsClientOptions {
  /** Base URL of the audit API. */
  baseUrl: string;
  /** The signed-in user's Firebase ID token; `forceRefresh` after a 401. */
  getToken: (forceRefresh?: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
}

/**
 * Reads GET /v1/analytics/summary from the audit API with the user's Firebase ID token (the audit API
 * verifies the identity token itself; it does not accept Hub session tokens). One token refresh after a 401.
 */
export class HttpAnalyticsClient implements AnalyticsClient {
  constructor(private readonly options: HttpAnalyticsClientOptions) {}

  async getSummary(range: AnalyticsRange, signal?: AbortSignal): Promise<AnalyticsSummary> {
    const url = new URL('/v1/analytics/summary', this.options.baseUrl);
    url.searchParams.set('from', range.from);
    url.searchParams.set('to', range.to);
    url.searchParams.set('granularity', range.granularity);

    let response = await this.fetchWith(url, await this.token(false), signal);
    if (response.status === 401) {
      response = await this.fetchWith(url, await this.token(true), signal);
    }
    if (response.status === 401) throw new AnalyticsError('unauthenticated', 'Your session is no longer valid.');
    if (response.status === 403) throw new AnalyticsError('forbidden', "Your account doesn't have access to analytics.");
    if (!response.ok) throw new AnalyticsError('unavailable', 'Analytics are temporarily unavailable.');

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AnalyticsError('bad_response', 'Analytics returned a response we could not read.');
    }
    const parsed = summarySchema.safeParse(json);
    if (!parsed.success) throw new AnalyticsError('bad_response', 'Analytics returned a response we could not read.');
    return parsed.data;
  }

  private async token(forceRefresh: boolean): Promise<string> {
    try {
      return await this.options.getToken(forceRefresh);
    } catch {
      throw new AnalyticsError('unauthenticated', 'Your session is no longer valid.');
    }
  }

  private async fetchWith(url: URL, token: string, signal?: AbortSignal): Promise<Response> {
    try {
      const doFetch = this.options.fetchImpl ?? fetch;
      return await doFetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') throw error;
      throw new AnalyticsError('unavailable', 'Analytics are temporarily unavailable.');
    }
  }
}
