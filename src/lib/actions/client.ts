import { z } from 'zod';

/**
 * Hub analytics and action bot API (/v1/analytics/*, /v1/goals/:id/creative).
 * Reports and proposals come from the Hub; nothing here changes a campaign except
 * an explicit owner decision on one proposal.
 */

export const PLATFORMS = ['reddit', 'microsoft', 'google', 'meta'] as const;
export type Platform = (typeof PLATFORMS)[number];

const metricValue = z.union([z.number(), z.literal('unknown')]).catch('unknown');

const metricRowSchema = z
  .object({
    impressions: metricValue,
    clicks: metricValue,
    spend: metricValue,
    conversions: metricValue,
    currency: z.string().optional(),
  })
  .passthrough();

const rulesSchema = z
  .object({
    pauseWhen: z.object({ minSpend: z.number(), maxConversions: z.number() }).optional(),
    capWhen: z.object({ minSpend: z.number(), maxCostPerConversion: z.number(), proposedDailyBudget: z.number() }).optional(),
  })
  .passthrough();

const campaignSchema = z.object({
  probaCampaignId: z.string(),
  goalId: z.string(),
  threadId: z.string(),
  platform: z.string(),
  accountId: z.string().nullable(),
  providerCampaignId: z.string().nullable(),
  currentDailyBudget: z.number().nullable(),
  currency: z.string().nullable(),
  reviewEnabled: z.boolean(),
  rules: rulesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const summarySchema = z
  .object({
    outcome: z.string().optional(),
    asOf: z.string().optional(),
    unknownMetrics: z.boolean().optional(),
    metrics: z.array(metricRowSchema).optional(),
    reviewWindowUntil: z.string().optional(),
  })
  .passthrough();

const reviewSchema = z.object({
  id: z.string(),
  probaCampaignId: z.string(),
  windowKey: z.string(),
  intent: z.string(),
  trigger: z.string(),
  status: z.string(),
  outcome: z.string().nullable(),
  decisionId: z.string().nullable(),
  summary: summarySchema.nullable(),
  errorCode: z.string().nullable(),
  coalesced: z.boolean().optional(),
  createdAt: z.string(),
});

const proposalSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  probaCampaignId: z.string(),
  platform: z.string(),
  accountId: z.string().nullable(),
  decisionId: z.string(),
  verb: z.string(),
  args: z.record(z.string(), z.unknown()),
  argsHash: z.string(),
  reason: z.string().nullable(),
  metrics: z.unknown(),
  reviewWindowUntil: z.string(),
  status: z.string(),
  decidedAt: z.string().nullable(),
  outcome: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

const creativeSchema = z.union([
  z.object({ type: z.literal('TEXT'), headline: z.string(), body: z.string() }),
  z.object({
    type: z.literal('IMAGE'),
    headline: z.string(),
    body: z.string().optional(),
    mediaUrl: z.string(),
    callToAction: z.string().optional(),
  }),
]);

const creativeResponseSchema = z.object({
  creative: creativeSchema.nullable(),
  targeting: z.record(z.string(), z.unknown()).nullable(),
  approvedAt: z.string().nullable(),
});

export type MetricRow = z.infer<typeof metricRowSchema>;
export type ReviewRules = z.infer<typeof rulesSchema>;
export type ReviewCampaign = z.infer<typeof campaignSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type ApprovedCreative = z.infer<typeof creativeSchema>;
export type CreativeRecord = z.infer<typeof creativeResponseSchema>;
export type ReviewIntent = 'report' | 'propose_pause' | 'propose_cap';

export interface RegisterCampaignInput {
  goalId: string;
  probaCampaignId: string;
  platform: Platform;
  accountId?: string;
  providerCampaignId?: string;
  currentDailyBudget?: number;
  currency?: string;
  rules?: ReviewRules;
}

export type ActionsErrorKind = 'unauthenticated' | 'unavailable' | 'not_found' | 'conflict' | 'invalid' | 'bad_response';

export class ActionsError extends Error {
  constructor(
    public readonly kind: ActionsErrorKind,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ActionsError';
  }
}

export interface ActionsClient {
  listCampaigns(signal?: AbortSignal): Promise<ReviewCampaign[]>;
  registerCampaign(input: RegisterCampaignInput): Promise<ReviewCampaign>;
  updateCampaign(
    probaCampaignId: string,
    patch: { reviewEnabled?: boolean; currentDailyBudget?: number | null; rules?: ReviewRules }
  ): Promise<ReviewCampaign>;
  requestReview(probaCampaignId: string, input: { intent: ReviewIntent; dailyBudget?: number }): Promise<Review>;
  listReviews(signal?: AbortSignal): Promise<Review[]>;
  listProposals(signal?: AbortSignal): Promise<Proposal[]>;
  decide(proposalId: string, decision: 'approve' | 'reject'): Promise<Proposal>;
  getCreative(goalId: string, signal?: AbortSignal): Promise<CreativeRecord>;
  saveCreative(goalId: string, creative: ApprovedCreative, targeting?: Record<string, unknown>): Promise<CreativeRecord>;
}

/** Plain-language messages for Hub error codes the owner can act on. */
const CODE_MESSAGES: Record<string, string> = {
  analytics_unavailable: 'Reviews are not set up on this Hub yet.',
  execution_paused: 'Activity is paused. Resume operations before approving an action.',
  proposal_expired: 'This proposal’s review window has passed. Request a new review.',
  proposal_not_pending: 'This proposal has already been decided or replaced.',
  cap_not_decrease: 'A budget cap must be lower than the current daily budget.',
  budget_unknown: 'Set the current daily budget before proposing a cap.',
  campaign_exists: 'That campaign is already registered for review.',
  goal_not_found: 'That goal was not found.',
  campaign_not_found: 'That campaign was not found.',
  review_disabled: 'Scheduled reviews are turned off for this campaign.',
};

export interface HubActionsClientOptions {
  apiBaseUrl: string;
  token: string;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export class HubActionsClient implements ActionsClient {
  constructor(private readonly options: HubActionsClientOptions) {}

  async listCampaigns(signal?: AbortSignal) {
    const body = await this.request('GET', '/v1/analytics/campaigns', undefined, signal);
    return this.parse(z.object({ campaigns: z.array(campaignSchema) }), body).campaigns;
  }

  async registerCampaign(input: RegisterCampaignInput) {
    const body = await this.request('POST', '/v1/analytics/campaigns', input);
    return this.parse(z.object({ campaign: campaignSchema }), body).campaign;
  }

  async updateCampaign(
    probaCampaignId: string,
    patch: { reviewEnabled?: boolean; currentDailyBudget?: number | null; rules?: ReviewRules }
  ) {
    const body = await this.request('PATCH', `/v1/analytics/campaigns/${encodeURIComponent(probaCampaignId)}`, patch);
    return this.parse(z.object({ campaign: campaignSchema }), body).campaign;
  }

  async requestReview(probaCampaignId: string, input: { intent: ReviewIntent; dailyBudget?: number }) {
    const body = await this.request('POST', `/v1/analytics/campaigns/${encodeURIComponent(probaCampaignId)}/review`, input);
    return this.parse(z.object({ review: reviewSchema }), body).review;
  }

  async listReviews(signal?: AbortSignal) {
    const body = await this.request('GET', '/v1/analytics/reviews', undefined, signal);
    return this.parse(z.object({ reviews: z.array(reviewSchema) }), body).reviews;
  }

  async listProposals(signal?: AbortSignal) {
    const body = await this.request('GET', '/v1/analytics/proposals', undefined, signal);
    return this.parse(z.object({ proposals: z.array(proposalSchema) }), body).proposals;
  }

  async decide(proposalId: string, decision: 'approve' | 'reject') {
    const body = await this.request('POST', `/v1/analytics/proposals/${encodeURIComponent(proposalId)}/decision`, { decision });
    return this.parse(z.object({ proposal: proposalSchema }), body).proposal;
  }

  async getCreative(goalId: string, signal?: AbortSignal) {
    const body = await this.request('GET', `/v1/goals/${encodeURIComponent(goalId)}/creative`, undefined, signal);
    return this.parse(creativeResponseSchema, body);
  }

  async saveCreative(goalId: string, creative: ApprovedCreative, targeting?: Record<string, unknown>) {
    const body = await this.request('PUT', `/v1/goals/${encodeURIComponent(goalId)}/creative`, {
      creative,
      ...(targeting ? { targeting } : {}),
    });
    return this.parse(creativeResponseSchema, body);
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ActionsError('bad_response', 'The Hub returned a response we could not read.');
    return parsed.data;
  }

  private async request(method: string, path: string, payload?: unknown, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(path, this.options.apiBaseUrl).toString();
    let response: Response;
    try {
      const doFetch = this.options.fetchImpl ?? fetch;
      response = await doFetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: 'application/json',
          ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
        signal,
      });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') throw error;
      throw new ActionsError('unavailable', 'The Hub is not reachable right now.');
    }
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (response.ok) return json;
    const code = typeof (json as { error?: unknown } | null)?.error === 'string' ? (json as { error: string }).error : undefined;
    const serverMessage =
      typeof (json as { message?: unknown } | null)?.message === 'string' ? (json as { message: string }).message : undefined;
    const message = (code && CODE_MESSAGES[code]) ?? serverMessage ?? 'The Hub could not complete this request.';
    if (response.status === 401) {
      this.options.onUnauthorized?.();
      throw new ActionsError('unauthenticated', 'Your session is no longer valid.', code);
    }
    if (response.status === 404) throw new ActionsError('not_found', message, code);
    if (response.status === 409) throw new ActionsError('conflict', message, code);
    if (response.status === 400) throw new ActionsError('invalid', message, code);
    throw new ActionsError('unavailable', message, code);
  }
}

/** Cost per conversion; undefined whenever spend or conversions is unknown or zero conversions. */
export function costPerConversion(row: MetricRow): number | undefined {
  return typeof row.spend === 'number' && typeof row.conversions === 'number' && row.conversions > 0
    ? row.spend / row.conversions
    : undefined;
}

/** Totals across rows; any unknown value makes that total unknown (never zero). */
export function metricTotals(rows: MetricRow[]): Record<'impressions' | 'clicks' | 'spend' | 'conversions', number | 'unknown'> {
  const keys = ['impressions', 'clicks', 'spend', 'conversions'] as const;
  const out = {} as Record<(typeof keys)[number], number | 'unknown'>;
  for (const key of keys) {
    out[key] = rows.length === 0 ? 'unknown' : rows.reduce<number | 'unknown'>((acc, row) => {
      const v = row[key];
      return acc === 'unknown' || v === 'unknown' ? 'unknown' : acc + v;
    }, 0);
  }
  return out;
}

/** Owner-facing description of a proposal's action. */
export function describeProposal(p: Pick<Proposal, 'verb' | 'args'>): string {
  if (p.verb === 'ads.pause_campaign') return 'Pause this campaign';
  if (p.verb === 'ads.update_campaign' && typeof p.args.dailyBudget === 'number') {
    const currency = typeof p.args.currency === 'string' ? ` ${p.args.currency}` : '';
    return `Lower the daily budget cap to ${p.args.dailyBudget}${currency}`;
  }
  return 'Change this campaign';
}
