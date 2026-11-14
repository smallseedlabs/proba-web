import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import type { Session } from '../../lib/auth';
import { SHORT_VIEWPORT_QUERY } from '../../lib/utils/useMediaQuery';
import { WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { GoalsView } from './GoalsView';

const SESSION: Session = {
  token: 't',
  user: { id: 'u', email: 'alex@example.com', name: 'Alex Morgan' },
  workspaces: [{ id: 'ws', name: 'Northwind' }],
};

const EVENTS: IncomingEvent[] = [
  {
    kind: 'event',
    seq: 1,
    at: '2026-10-26T10:00:00Z',
    type: 'goal_updated',
    threadId: 't1',
    payload: { goalId: 'g1', status: 'active' },
    ui: {
      component: 'goal_summary',
      version: '1',
      props: { title: 'Validate UK demand for the Trailhead 2 boot', metrics: { spend: 50, budget: 200, currency: 'USD', impressions: 1200, clicks: 40 } },
    },
  },
  {
    kind: 'event',
    seq: 2,
    at: '2026-10-26T10:01:00Z',
    type: 'message',
    threadId: 't1',
    payload: { source: 'assistant', text: 'I will research the UK market and wait for your approval before spending.' },
  },
  {
    kind: 'event',
    seq: 3,
    at: '2026-10-26T10:02:00Z',
    type: 'message',
    threadId: 't1',
    payload: { source: 'user', text: 'Please keep the budget under £200.' },
  },
];

function mockMatchMedia(short: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: short && query === SHORT_VIEWPORT_QUERY,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function renderGoal(short: boolean) {
  mockMatchMedia(short);
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand: vi.fn(),
    subscribe: (l) => {
      EVENTS.forEach((e) => l(e));
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <div style={{ height: short ? 593 : 900 }}>
      <ToastProvider>
        <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
          <GoalsView selectedId="g1" session={SESSION} />
        </WorkspaceProvider>
      </ToastProvider>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoalsView header', () => {
  it('shows the full goal header on a tall viewport', () => {
    renderGoal(false);
    expect(screen.getByRole('heading', { name: 'Validate UK demand for the Trailhead 2 boot' })).toHaveClass('text-heading');
    expect(screen.getByText('Impressions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
    expect(screen.getByTestId('goal-thread-scroller')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Conversation' })).toBeInTheDocument();
  });

  it('collapses the goal header on a short viewport so details are hidden until opened', async () => {
    const user = userEvent.setup();
    renderGoal(true);
    const header = screen.getByTestId('goal-header');
    expect(screen.getByRole('heading', { name: 'Validate UK demand for the Trailhead 2 boot' })).toHaveClass('truncate', 'text-title');
    expect(within(header).queryByText('Impressions')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(header).getByText('Impressions')).toBeInTheDocument();
  });
});
