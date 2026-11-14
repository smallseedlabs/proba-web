import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AnalyticsClient, AnalyticsSummary } from '../../lib/analytics/client';
import { AnalyticsError } from '../../lib/analytics/client';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import { ActionsProvider } from '../../state/actions';
import { AnalyticsProvider } from '../../state/analytics';
import { WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { CampaignsView } from './CampaignsView';

const THREAD = 't-boot';
const GOAL = 'g-boot';

const point = (bucket: string, spend: number, conversions: number) => ({ bucket, currency: 'USD', impressions: 100, clicks: 10, spend, conversions });
const SUMMARY: AnalyticsSummary = {
  granularity: 'day',
  series: [point('2026-10-25T00:00:00.000Z', 11, 4), point('2026-10-26T00:00:00.000Z', 22, 9)],
};

/** Events the Hub would have sent, including a metric_chart "report" that must NOT be drawn any more. */
const EVENTS: IncomingEvent[] = [
  {
    kind: 'event', seq: 1, at: '2026-10-26T10:00:00Z', type: 'goal_updated', threadId: THREAD,
    payload: { goalId: GOAL, status: 'active' },
    ui: { component: 'goal_summary', version: '1', props: { title: 'Trailhead boot', metrics: { spend: 50, budget: 200, currency: 'USD' } } },
  },
  {
    kind: 'event', seq: 2, at: '2026-10-26T10:01:00Z', type: 'message', threadId: THREAD, payload: {},
    ui: { component: 'metric_chart', version: '1', props: { title: 'Scenario chart', type: 'line', data: [{ label: 'a', value: 999 }] } },
  },
];

function renderCampaign(client: AnalyticsClient | null) {
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand: vi.fn(),
    subscribe: (listener) => {
      EVENTS.forEach((e) => listener(e));
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <AnalyticsProvider client={client}>
        <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
          <CampaignsView selectedId={GOAL} />
        </WorkspaceProvider>
      </AnalyticsProvider>
    </ToastProvider>
  );
}

describe('CampaignsView charts', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('draws the charts from the audit analytics series, not from events in the conversation', async () => {
    const getSummary = vi.fn().mockResolvedValue(SUMMARY);
    renderCampaign({ getSummary });

    expect(await screen.findByRole('heading', { name: 'Daily conversions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument();
    expect(screen.queryByText('Scenario chart')).not.toBeInTheDocument();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary.mock.calls[0][0]).toMatchObject({ granularity: 'day' });
    expect(getSummary.mock.calls[0][0].from).toMatch(/T00:00:00\.000Z$/);
    // The figures are the analytics series' (latest 9 conversions, $22 spend), not anything from an event.
    expect(screen.getByText(/Daily conversions\. 2 data points from 25 Oct to 26 Oct\. Latest 9,/)).toBeInTheDocument();
    expect(screen.getByText(/Spend\. 2 data points from 25 Oct to 26 Oct\. Latest \$22,/)).toBeInTheDocument();
  });

  it('says charts are not connected when no audit API is configured, and shows no invented data', async () => {
    renderCampaign(null);
    expect(await screen.findByText('Charts are not connected')).toBeInTheDocument();
    expect(screen.queryByText('Scenario chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Daily conversions' })).not.toBeInTheDocument();
  });

  it('explains a 403 and an outage differently', async () => {
    renderCampaign({ getSummary: vi.fn().mockRejectedValue(new AnalyticsError('forbidden', 'no')) });
    expect(await screen.findByText('Charts are not available to your account')).toBeInTheDocument();
  });

  it('shows a temporary-unavailable state when analytics fail', async () => {
    renderCampaign({ getSummary: vi.fn().mockRejectedValue(new AnalyticsError('unavailable', 'down')) });
    expect(await screen.findByText('Charts are temporarily unavailable')).toBeInTheDocument();
  });

  it('shows 0-baseline charts when the audit API has no series yet', async () => {
    renderCampaign({ getSummary: vi.fn().mockResolvedValue({ granularity: 'day', series: [] }) });
    expect(await screen.findByRole('heading', { name: 'Daily conversions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument();
    expect(screen.getByText(/No performance data yet — showing 0 baseline/)).toBeInTheDocument();
  });

  it('shows the loading state while analytics load', async () => {
    let resolve: (s: AnalyticsSummary) => void = () => {};
    renderCampaign({ getSummary: () => new Promise((r) => (resolve = r)) });
    expect(await screen.findByLabelText('Loading charts')).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve(SUMMARY));
    expect(await screen.findByRole('heading', { name: 'Daily conversions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument();
  });

  it('scopes analytics charts to the selected goal campaigns across providers when goal status is available', async () => {
    const getSummary = vi.fn().mockImplementation(async (range: { campaignId?: string }) => ({
      granularity: 'day',
      series: [
        point('2026-10-25T00:00:00.000Z', range.campaignId === 'cmp-reddit' ? 10 : 5, range.campaignId === 'cmp-reddit' ? 2 : 1),
      ],
    }));
    const getGoalStatus = vi.fn().mockResolvedValue({
      goal: { id: GOAL, title: 'Trailhead boot', status: 'active' },
      plan: null,
      now: {
        state: 'running',
        campaigns: [
          { probaCampaignId: 'cmp-reddit', platform: 'reddit', currentDailyBudget: 5, currency: 'GBP', reviewEnabled: true, lastReviewedAt: null },
          { probaCampaignId: 'cmp-meta', platform: 'meta', currentDailyBudget: 5, currency: 'GBP', reviewEnabled: true, lastReviewedAt: null },
        ],
        pendingProposals: 0,
      },
      next: null,
      spend: { spent: 0, dailyCap: 10, totalCap: 50, currency: 'GBP' },
      progress: { metric: 'clicks', target: 100, actual: 0, checkpointsDone: [] },
      decisions: [],
    });
    const transport: TransportClient = {
      status: 'open',
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendCommand: vi.fn(),
      subscribe: (listener) => {
        EVENTS.forEach((e) => listener(e));
        return () => {};
      },
      onStatusChange: () => () => {},
    };
    const getCreative = vi.fn().mockResolvedValue({ creative: null, targeting: null, approvedAt: null });
    render(
      <ToastProvider>
        <ActionsProvider client={{ getGoalStatus, getCreative } as never}>
          <AnalyticsProvider client={{ getSummary }}>
            <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
              <CampaignsView selectedId={GOAL} />
            </WorkspaceProvider>
          </AnalyticsProvider>
        </ActionsProvider>
      </ToastProvider>
    );

    await vi.waitFor(() => {
      expect(getSummary).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'cmp-reddit' }), expect.any(AbortSignal));
      expect(getSummary).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'cmp-meta' }), expect.any(AbortSignal));
    });
    expect(await screen.findByText(/for this Proba campaign \(reddit, meta\)/, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders platform delivery status and moderation causes in GoalStatusPanel', async () => {
    const getSummary = vi.fn().mockResolvedValue({ granularity: 'day', series: [] });
    const getGoalStatus = vi.fn().mockResolvedValue({
      goal: { id: GOAL, title: 'Trailhead boot', status: 'active' },
      plan: null,
      now: {
        state: 'running',
        campaigns: [
          {
            probaCampaignId: 'cmp-reddit',
            platform: 'reddit',
            accountId: 'a2_test',
            providerCampaignId: '2635168666659267454',
            currentDailyBudget: 5,
            currency: 'GBP',
            reviewEnabled: true,
            lastReviewedAt: null,
            delivery: {
              state: 'in_moderation',
              label: 'In moderation',
              summary: 'Ad is not running yet because it is in Reddit Ads moderation review. Delivery starts automatically once approved.',
              causes: [
                'Ad is in Reddit moderation review (pending admin approval)',
                'Ad account funding or payment method verification is pending',
              ],
              campaignConfiguredStatus: 'ACTIVE',
              campaignEffectiveStatus: 'PAUSED',
              adGroupEffectiveStatus: 'PAUSED',
              adEffectiveStatus: 'PENDING_APPROVAL',
              rejectionReason: null,
              postUrl: 'https://www.reddit.com/comments/1xw4s5r',
              previewUrl: 'https://www.reddit.com/?ad=preview',
              checkedAt: '2026-11-14T16:30:00.000Z',
            },
          },
        ],
        pendingProposals: 0,
      },
      next: null,
      spend: { spent: null, dailyCap: 5, totalCap: 50, currency: 'GBP' },
      progress: { metric: 'clicks', target: 100, actual: null, checkpointsDone: [] },
      decisions: [],
    });
    const transport: TransportClient = {
      status: 'open',
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendCommand: vi.fn(),
      subscribe: (listener) => {
        EVENTS.forEach((e) => listener(e));
        return () => {};
      },
      onStatusChange: () => () => {},
    };
    const getCreative = vi.fn().mockResolvedValue({ creative: null, targeting: null, approvedAt: null });
    const { ActionsProvider } = await import('../../state/actions');
    const { GoalStatusPanel } = await import('./GoalStatusPanel');
    render(
      <ToastProvider>
        <ActionsProvider client={{ getGoalStatus, getCreative } as never}>
          <AnalyticsProvider client={{ getSummary }}>
            <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
              <GoalStatusPanel goalId={GOAL} />
            </WorkspaceProvider>
          </AnalyticsProvider>
        </ActionsProvider>
      </ToastProvider>
    );

    expect(await screen.findByText('Platforms & delivery status')).toBeInTheDocument();
    expect(screen.getByText('Reddit Ads')).toBeInTheDocument();
    expect(screen.getByText('In moderation')).toBeInTheDocument();
    expect(screen.getByText(/Ad is in Reddit moderation review \(pending admin approval\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Reddit post/i })).toHaveAttribute('href', 'https://www.reddit.com/comments/1xw4s5r');
  });
});
