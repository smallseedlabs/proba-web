import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AnalyticsClient, AnalyticsSummary } from '../../lib/analytics/client';
import { AnalyticsError } from '../../lib/analytics/client';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
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

  it('shows an empty state when the audit API has no series yet', async () => {
    renderCampaign({ getSummary: vi.fn().mockResolvedValue({ granularity: 'day', series: [] }) });
    expect(await screen.findByText('No performance data yet')).toBeInTheDocument();
  });

  it('shows the loading state while analytics load', async () => {
    let resolve: (s: AnalyticsSummary) => void = () => {};
    renderCampaign({ getSummary: () => new Promise((r) => (resolve = r)) });
    expect(await screen.findByLabelText('Loading charts')).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve(SUMMARY));
    expect(await screen.findByRole('heading', { name: 'Daily conversions' })).toBeInTheDocument();
  });
});
