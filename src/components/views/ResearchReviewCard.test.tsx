import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AskPayload } from '../../lib/protocol';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import { ToastProvider } from '../ui/toast';
import { WorkspaceProvider } from '../../state/workspace';
import { ResearchReviewCard } from './ResearchReviewCard';
import { AskCard } from './AskCard';

const ARTIFACT_ID = 'aa0e8400-e29b-41d4-a716-446655440010';
const ASK_ID = 'bb0e8400-e29b-41d4-a716-446655440011';
const REVISION = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const LANDING = 'https://operator-entered.example/path';
const XSS_TEXT = '<img src=x onerror=alert(1)> Research<script>alert(1)</script>';
const XSS_URL = 'javascript:alert(document.domain)';

const research: NonNullable<AskPayload['research']> = {
  verb: 'research.accept',
  artifactId: ARTIFACT_ID,
  version: 1,
  inputRevision: REVISION,
  landingPageUrl: LANDING,
  status: 'awaiting_acceptance',
  findings: [{ id: 'f1', text: XSS_TEXT, sourceIds: ['page-1'] }],
  assumptions: [{ id: 'a1', text: 'Operator supplied the landing URL.', basis: 'user_input' }],
  unknowns: [{ id: 'u1', text: 'Audience was not verified.' }],
  sources: [
    { sourceId: 'page-1', kind: 'http_url', url: LANDING, sha256: SHA },
    { sourceId: 'evil', kind: 'http_url', url: XSS_URL, sha256: SHA },
  ],
};

const askPayload: AskPayload = {
  askId: ASK_ID,
  askType: 'research_review',
  title: 'Review sourced research',
  description: 'Accept findings for this landing-URL revision. This is not campaign spend approval.',
  blocking: true,
  risk: 'high',
  onExpire: 'deny',
  questions: [{ id: 'research-accept', type: 'confirm', label: 'Accept this sourced research?', required: true }],
  research,
};

const reviewEvent: IncomingEvent = {
  kind: 'event',
  seq: 9,
  at: '2026-11-08T17:00:02Z',
  type: 'ask',
  threadId: 'ee0e8400-e29b-41d4-a716-446655440014',
  payload: askPayload as unknown as Record<string, unknown>,
  ui: {
    component: 'approval_card',
    version: '1.0.0',
    props: { title: 'Should not render as budget', currentValue: '$40', proposedValue: '$65', risk: 'high' },
  },
  fallbackText: 'Research review fallback',
};

const budgetAsk: IncomingEvent = {
  kind: 'event',
  seq: 2,
  at: '2026-10-26T10:01:00Z',
  type: 'ask',
  threadId: 't1',
  payload: {
    askId: 'a1',
    askType: 'action_approval',
    title: 'Move more daily budget to variant B',
    blocking: true,
    risk: 'medium',
    questions: [],
    costEffect: { current: 100, proposed: 120, currency: 'USD', impact: '20.0%' },
  },
  ui: {
    component: 'approval_card',
    version: '1.0.0',
    props: {
      title: 'Move more daily budget to variant B',
      currentValue: '$100',
      proposedValue: '$120',
      risk: 'medium',
      costImpact: { current: 100, proposed: 120, currency: 'USD' },
    },
  },
};

function renderWithTransport(event: IncomingEvent, extra: IncomingEvent[] = []) {
  const sendCommand = vi.fn().mockResolvedValue(undefined);
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand,
    subscribe: (listener) => {
      extra.concat(event).forEach((item) => listener(item));
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
        <AskCard event={event} />
      </WorkspaceProvider>
    </ToastProvider>
  );
  return { sendCommand };
}

describe('ResearchReviewCard', () => {
  it('renders sourced findings and is not a budget approval card', () => {
    renderWithTransport(reviewEvent);
    const card = screen.getByRole('region', { name: /Research review: Review sourced research/ });
    expect(within(card).getByText('Findings')).toBeInTheDocument();
    expect(within(card).getByText('Assumptions')).toBeInTheDocument();
    expect(within(card).getByText('Unknowns')).toBeInTheDocument();
    expect(within(card).getByText(ARTIFACT_ID)).toBeInTheDocument();
    expect(within(card).getByText(REVISION)).toBeInTheDocument();
    expect(within(card).getByText('1')).toBeInTheDocument();
    expect(within(card).getByText(/does not approve spend/i)).toBeInTheDocument();
    expect(within(card).queryByText('Current')).not.toBeInTheDocument();
    expect(within(card).queryByText('Proposed')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Accept research' })).toBeInTheDocument();
  });

  it('escapes untrusted finding text and does not make executable URLs into links', () => {
    renderWithTransport(reviewEvent);
    const card = screen.getByRole('region', { name: /Research review/ });
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('script')).toBeNull();
    expect(within(card).getByText(XSS_TEXT)).toBeInTheDocument();
    const evil = within(card).getByText(XSS_URL);
    expect(evil.closest('a')).toBeNull();
    const landing = within(card).getAllByRole('link', { name: LANDING });
    expect(landing[0]).toHaveAttribute('href', LANDING);
    expect(landing[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('sends researchAcceptance for the displayed artifact on accept and reject', async () => {
    const { sendCommand } = renderWithTransport(reviewEvent);
    const card = screen.getByRole('region', { name: /Research review/ });
    await userEvent.click(within(card).getByRole('button', { name: 'Accept research' }));
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'answer_ask',
        payload: {
          askId: ASK_ID,
          choice: 'approve',
          researchAcceptance: { artifactId: ARTIFACT_ID, version: 1, inputRevision: REVISION },
        },
      })
    );
    expect(sendCommand.mock.calls[0][0].payload.userSuppliedInput).toBeUndefined();
  });

  it('sends researchAcceptance on reject without granting spend fields', async () => {
    const { sendCommand } = renderWithTransport(reviewEvent);
    await userEvent.click(screen.getByRole('button', { name: 'Reject research' }));
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'answer_ask',
        payload: {
          askId: ASK_ID,
          choice: 'reject',
          researchAcceptance: { artifactId: ARTIFACT_ID, version: 1, inputRevision: REVISION },
        },
      })
    );
  });

  it('invalidates on edit with a new operator URL and does not prefill the field', async () => {
    const { sendCommand } = renderWithTransport(reviewEvent);
    const card = screen.getByRole('region', { name: /Research review/ });
    await userEvent.click(within(card).getByRole('button', { name: 'Edit landing URL' }));
    const input = within(card).getByLabelText(/Replacement landing page URL/);
    expect(input).toHaveValue('');
    expect(input).not.toHaveValue(expect.stringMatching(/smallseedlabs/i));
    await userEvent.click(within(card).getByRole('button', { name: 'Send new URL' }));
    expect(sendCommand).not.toHaveBeenCalled();
    await userEvent.type(input, 'javascript:alert(1)');
    await userEvent.click(within(card).getByRole('button', { name: 'Send new URL' }));
    expect(sendCommand).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, 'https://operator-entered.example/new-path');
    await userEvent.click(within(card).getByRole('button', { name: 'Send new URL' }));
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'answer_ask',
        payload: expect.objectContaining({
          askId: ASK_ID,
          choice: 'edit',
          researchAcceptance: { artifactId: ARTIFACT_ID, version: 1, inputRevision: REVISION },
          userSuppliedInput: { landingPageUrl: 'https://operator-entered.example/new-path' },
        }),
      })
    );
  });

  it('blocks accept when the artifact is missing', () => {
    const send = vi.fn();
    const missing: AskPayload = { ...askPayload, research: undefined };
    render(
      <ResearchReviewCard
        ask={missing}
        event={reviewEvent}
        onAction={(request) => send(request)}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/no current sourced artifact/i);
    expect(screen.queryByRole('button', { name: 'Accept research' })).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('legacy approval cards', () => {
  it('still renders budget action_approval as an approval card', () => {
    renderWithTransport(budgetAsk);
    const card = screen.getByRole('region', { name: /Approval required: Move more daily budget to variant B/ });
    expect(within(card).getByText('Current')).toBeInTheDocument();
    expect(within(card).getByText('Proposed')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Accept research' })).not.toBeInTheDocument();
  });
});
