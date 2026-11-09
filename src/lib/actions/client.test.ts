import { describe, expect, it, vi } from 'vitest';
import { ActionsError, HubActionsClient, describeProposal, metricTotals } from './client';

const API = 'https://hub.operator-entered.example';

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const PROPOSAL = {
  id: 'p1',
  reviewId: 'r1',
  probaCampaignId: 'pc-1',
  platform: 'reddit',
  accountId: 'a1',
  decisionId: 'd1',
  verb: 'ads.pause_campaign',
  args: { probaCampaignId: 'pc-1' },
  argsHash: 'h',
  reason: 'spend 60 >= 50 with 0 conversions',
  metrics: [{ impressions: 10, clicks: 'unknown', spend: 60, conversions: 0 }],
  reviewWindowUntil: '2026-11-09T18:00:00.000Z',
  status: 'pending',
  decidedAt: null,
  outcome: null,
  createdAt: '2026-11-09T12:00:00.000Z',
};

describe('HubActionsClient', () => {
  it('sends the Hub session token and parses proposals', async () => {
    const fetchImpl = respond(200, { proposals: [PROPOSAL] });
    const client = new HubActionsClient({ apiBaseUrl: API, token: 'hub-session', fetchImpl });
    const proposals = await client.listProposals();
    expect(proposals[0]?.id).toBe('p1');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/v1/analytics/proposals`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer hub-session');
  });

  it('posts exactly one decision for one proposal', async () => {
    const fetchImpl = respond(200, { proposal: { ...PROPOSAL, status: 'executed' } });
    const client = new HubActionsClient({ apiBaseUrl: API, token: 't', fetchImpl });
    const result = await client.decide('p1', 'approve');
    expect(result.status).toBe('executed');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/v1/analytics/proposals/p1/decision`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ decision: 'approve' });
  });

  it('maps Hub refusals to owner-facing messages and calls onUnauthorized on 401', async () => {
    const paused = new HubActionsClient({ apiBaseUrl: API, token: 't', fetchImpl: respond(409, { error: 'execution_paused' }) });
    await expect(paused.decide('p1', 'approve')).rejects.toMatchObject({ kind: 'conflict', code: 'execution_paused' });
    const onUnauthorized = vi.fn();
    const expired = new HubActionsClient({ apiBaseUrl: API, token: 't', onUnauthorized, fetchImpl: respond(401, {}) });
    await expect(expired.listCampaigns()).rejects.toBeInstanceOf(ActionsError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    const garbled = new HubActionsClient({ apiBaseUrl: API, token: 't', fetchImpl: respond(200, { proposals: 'x' }) });
    await expect(garbled.listProposals()).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('keeps unknown metrics unknown in totals instead of zero', () => {
    expect(metricTotals([{ impressions: 10, clicks: 'unknown', spend: 5, conversions: 0 }, { impressions: 5, clicks: 3, spend: 1, conversions: 1 }])).toEqual({
      impressions: 15,
      clicks: 'unknown',
      spend: 6,
      conversions: 1,
    });
    expect(metricTotals([]).spend).toBe('unknown');
  });

  it('describes pause and cap proposals plainly', () => {
    expect(describeProposal({ verb: 'ads.pause_campaign', args: {} })).toBe('Pause this campaign');
    expect(describeProposal({ verb: 'ads.update_campaign', args: { dailyBudget: 20, currency: 'USD' } })).toBe('Lower the daily budget cap to 20 USD');
  });
});
