import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ActionsClient, Proposal } from '../../lib/actions/client';
import type { TransportClient } from '../../lib/transport';
import { ActionsProvider } from '../../state/actions';
import { WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { ActionsView } from './ActionsView';

const PROPOSAL: Proposal = {
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

function client(overrides: Partial<ActionsClient> = {}): ActionsClient {
  return {
    listCampaigns: vi.fn(async () => []),
    registerCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    requestReview: vi.fn(),
    listReviews: vi.fn(async () => []),
    listProposals: vi.fn(async () => [PROPOSAL]),
    decide: vi.fn(async () => ({ ...PROPOSAL, status: 'executed' })),
    getCreative: vi.fn(),
    saveCreative: vi.fn(),
    ...overrides,
  } as ActionsClient;
}

function renderView(c: ActionsClient | null) {
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand: vi.fn(),
    subscribe: () => () => {},
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <ActionsProvider client={c}>
        <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
          <ActionsView />
        </WorkspaceProvider>
      </ActionsProvider>
    </ToastProvider>
  );
}

describe('ActionsView', () => {
  it('shows a pending proposal with unknown metrics as Unknown and nothing applied before a decision', async () => {
    const c = client();
    renderView(c);
    expect(await screen.findByText('Pause this campaign')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(c.decide).not.toHaveBeenCalled();
  });

  it('approves only after confirming, then reports the outcome', async () => {
    const c = client();
    renderView(c);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(c.decide).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(c.decide).toHaveBeenCalledWith('p1', 'approve'));
    expect(await screen.findByText('Approved and applied.')).toBeInTheDocument();
  });

  it('rejecting sends a reject decision', async () => {
    const c = client({ decide: vi.fn(async () => ({ ...PROPOSAL, status: 'rejected' })) });
    renderView(c);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(c.decide).toHaveBeenCalledWith('p1', 'reject'));
  });

  it('explains when reviews are not available', () => {
    renderView(null);
    expect(screen.getByText('Reviews are not available here')).toBeInTheDocument();
  });
});
