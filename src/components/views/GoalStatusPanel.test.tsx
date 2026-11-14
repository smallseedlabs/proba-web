import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ActionsClient, GoalStatus } from '../../lib/actions/client';
import { ActionsProvider } from '../../state/actions';
import { GoalStatusPanel } from './GoalStatusPanel';

const STATUS: GoalStatus = {
  goal: { id: 'g1', title: 'Boots', status: 'active' },
  plan: { successMetric: 'clicks', successTarget: 200, reasons: { successMetric: 'the page has no pixel yet' } },
  now: {
    state: 'awaiting_approval',
    campaigns: [{ probaCampaignId: 'c1', platform: 'reddit', currentDailyBudget: 5, currency: 'USD', reviewEnabled: true, lastReviewedAt: null }],
    pendingProposals: 1,
  },
  next: { checkAt: '2026-11-16T10:00:00.000Z', reason: 'see if CPC settles', probaCampaignId: 'c1' },
  spend: { spent: null, dailyCap: 5, totalCap: null, currency: 'USD' },
  progress: { metric: 'clicks', target: 200, actual: null, checkpointsDone: [] },
  decisions: [
    {
      at: '2026-11-14T10:00:00.000Z',
      probaCampaignId: 'c1',
      trigger: 'event',
      kind: 'review',
      decision: 'change',
      summary: 'CPC is twice the plan.',
      whyNowOrNotYet: 'A small reversible trim.',
      nextCheckAt: '2026-11-15T10:00:00.000Z',
      nextCheckReason: 'see if CPC settles',
      checkpoint: null,
      proposal: { id: 'p1', verb: 'ads.update_campaign', status: 'pending' },
    },
  ],
};

describe('GoalStatusPanel', () => {
  it('shows Now / Next / Spend vs cap / Progress / Recent decisions with unknown kept unknown', async () => {
    const client = { getGoalStatus: vi.fn(async () => STATUS) } as unknown as ActionsClient;
    render(
      <ActionsProvider client={client}>
        <GoalStatusPanel goalId="g1" />
      </ActionsProvider>
    );
    expect(await screen.findByText(/a change is waiting for your approval/)).toBeInTheDocument();
    expect(screen.getByText('see if CPC settles')).toBeInTheDocument();
    // Spent and actual clicks are unknown: never shown as zero.
    expect(screen.getAllByText(/Unknown/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
    expect(screen.getByText(/Chosen because the page has no pixel yet/)).toBeInTheDocument();
    expect(screen.getByText('CPC is twice the plan.')).toBeInTheDocument();
    expect(screen.getByText('Why: A small reversible trim.')).toBeInTheDocument();
    expect(screen.getByText(/update campaign · pending/)).toBeInTheDocument();
  });

  it('renders nothing when the Hub has no status API', async () => {
    const client = { getGoalStatus: vi.fn(async () => Promise.reject(new Error('404'))) } as unknown as ActionsClient;
    const { container } = render(
      <ActionsProvider client={client}>
        <GoalStatusPanel goalId="g1" />
      </ActionsProvider>
    );
    await vi.waitFor(() => expect(client.getGoalStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders commentsAllowed badge and platform nativeMetrics from PlatformSpec', async () => {
    const withDelivery: GoalStatus = {
      ...STATUS,
      now: {
        state: 'running',
        campaigns: [
          {
            probaCampaignId: 'c1',
            platform: 'reddit',
            accountId: 'a2_1',
            providerCampaignId: 'cmp_1',
            currentDailyBudget: 10,
            currency: 'USD',
            reviewEnabled: true,
            lastReviewedAt: null,
            delivery: {
              state: 'delivering',
              label: 'Active · Delivering',
              summary: 'Campaign and ad creative are approved and actively delivering on Reddit Ads.',
              causes: [],
              campaignConfiguredStatus: 'ACTIVE',
              campaignEffectiveStatus: 'ACTIVE',
              adGroupEffectiveStatus: 'ACTIVE',
              adEffectiveStatus: 'ACTIVE',
              rejectionReason: null,
              postUrl: 'https://www.reddit.com/comments/1xw4s5r',
              previewUrl: null,
              commentsAllowed: true,
              nativeMetrics: {
                impressions: 1250,
                clicks: 40,
                spend: 8.5,
                ctr: 3.2,
                ecpm: 6.8,
              },
              checkedAt: '2026-11-14T18:00:00.000Z',
            },
          },
        ],
        pendingProposals: 0,
      },
    };
    const client = { getGoalStatus: vi.fn(async () => withDelivery) } as unknown as ActionsClient;
    render(
      <ActionsProvider client={client}>
        <GoalStatusPanel goalId="g1" />
      </ActionsProvider>
    );
    expect(await screen.findByText('Comments open')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('3.20%')).toBeInTheDocument();
    expect(screen.getByText('$6.80')).toBeInTheDocument();
  });

  it('triggers manual override pause for all platforms or a single platform', async () => {
    const withLive: GoalStatus = {
      ...STATUS,
      now: {
        state: 'running',
        campaigns: [
          {
            probaCampaignId: 'c1',
            platform: 'reddit',
            accountId: 'a2_1',
            providerCampaignId: 'cmp_1',
            currentDailyBudget: 10,
            currency: 'USD',
            reviewEnabled: true,
            lastReviewedAt: null,
            delivery: {
              state: 'delivering',
              label: 'Active · Delivering',
              summary: 'Delivering.',
              causes: [],
              campaignConfiguredStatus: 'ACTIVE',
              campaignEffectiveStatus: 'ACTIVE',
              adGroupEffectiveStatus: 'ACTIVE',
              adEffectiveStatus: 'ACTIVE',
              rejectionReason: null,
              postUrl: null,
              previewUrl: null,
              checkedAt: '2026-11-14T18:00:00.000Z',
            },
          },
        ],
        pendingProposals: 0,
      },
    };
    const pauseGoal = vi.fn(async () => ({ paused: 1, failed: 0 }));
    const pauseCampaign = vi.fn(async () => ({ paused: 1, failed: 0 }));
    const client = {
      getGoalStatus: vi.fn(async () => withLive),
      pauseGoal,
      pauseCampaign,
    } as unknown as ActionsClient;
    render(
      <ActionsProvider client={client}>
        <GoalStatusPanel goalId="g1" />
      </ActionsProvider>
    );
    const pauseAllBtn = await screen.findByRole('button', { name: 'Pause all platforms' });
    fireEvent.click(pauseAllBtn);
    await vi.waitFor(() => expect(pauseGoal).toHaveBeenCalledWith('g1'));

    const pauseRedditBtn = await screen.findByRole('button', { name: 'Pause Reddit' });
    fireEvent.click(pauseRedditBtn);
    await vi.waitFor(() => expect(pauseCampaign).toHaveBeenCalledWith('c1'));
  });
});
