import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '../../lib/auth';
import { DemoTransport } from '../../lib/demo/transport';
import { TransportError, type IncomingEvent, type TransportClient } from '../../lib/transport';
import { CONTROL_CONFIRM_TIMEOUT_MS, WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { AppShell } from './AppShell';

const session: Session = {
  token: 't',
  user: { id: 'u', email: 'alex@northwindoutdoor.com', name: 'Alex Morgan', role: 'Workspace admin' },
  workspaces: [
    { id: 'northwind', name: 'Northwind Outdoor' },
    { id: 'harbor', name: 'Harbor & Pine' },
  ],
};

function renderShell(transport: TransportClient, workspaceIndex = 0, extra: { onSessionExpired?: () => void } = {}) {
  const onSwitchWorkspace = vi.fn();
  const onSignOut = vi.fn();
  render(
    <ToastProvider>
      <WorkspaceProvider transport={transport} onSessionExpired={extra.onSessionExpired ?? vi.fn()}>
        <AppShell session={session} workspace={session.workspaces[workspaceIndex]} onSwitchWorkspace={onSwitchWorkspace} onSignOut={onSignOut} />
      </WorkspaceProvider>
    </ToastProvider>
  );
  return { onSwitchWorkspace, onSignOut };
}

/** A hub stand-in whose events the test controls: accepting a command does not change any state by itself. */
function hubTransport() {
  const listeners = new Set<(e: IncomingEvent) => void>();
  let seq = 0;
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    onStatusChange: () => () => {},
  };
  const emitStatus = (payload: Record<string, unknown>) =>
    act(() => {
      const event: IncomingEvent = { kind: 'event', seq: ++seq, at: new Date().toISOString(), type: 'status', payload };
      listeners.forEach((l) => l(event));
    });
  return { transport, emitStatus };
}

describe('AppShell', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the primary navigation with the current page marked', () => {
    renderShell(new DemoTransport({ workspaceId: 'northwind', latency: 0 }));
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
    for (const label of ['Goals', 'Approvals', 'Activity', 'Campaigns', 'Settings']) {
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: /Goals/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Approvals 2 awaiting your decision/ })).toBeInTheDocument();
  });

  it('pauses and resumes all activity through the control command', async () => {
    const transport = new DemoTransport({ workspaceId: 'northwind', latency: 0 });
    const send = vi.spyOn(transport, 'sendCommand');
    renderShell(transport);

    await userEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'control', payload: { action: 'pause' } }));
    expect(await screen.findByText('All activity is paused')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume all activity' }));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'control', payload: { action: 'resume' } }));
    await waitFor(() => expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument());
  });

  it('asks for confirmation before the emergency stop and can be cancelled with Escape', async () => {
    const transport = new DemoTransport({ workspaceId: 'northwind', latency: 0 });
    const send = vi.spyOn(transport, 'sendCommand');
    renderShell(transport);

    const trigger = screen.getByRole('button', { name: 'Emergency stop: halt all campaigns' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog', { name: 'Stop all campaigns now?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(send).not.toHaveBeenCalled();

    await userEvent.click(trigger);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Stop all campaigns' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'control', payload: { action: 'kill' } }));
    expect(await screen.findByRole('button', { name: 'Resume operations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency stop: halt all campaigns' })).toBeDisabled();
  });

  it('switches workspace from the keyboard-accessible workspace menu', async () => {
    const { onSwitchWorkspace } = renderShell(new DemoTransport({ workspaceId: 'northwind', latency: 0 }));
    const trigger = screen.getByRole('button', { name: /switch workspace/ });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items[0]).toHaveFocus();
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSwitchWorkspace).toHaveBeenCalledWith('harbor');
  });

  it('signs out from the user menu', async () => {
    const { onSignOut } = renderShell(new DemoTransport({ workspaceId: 'northwind', latency: 0 }));
    await userEvent.click(screen.getByRole('button', { name: /Alex Morgan Workspace admin.*account menu/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows the empty state for a new workspace', () => {
    renderShell(new DemoTransport({ workspaceId: 'harbor', latency: 0 }), 1);
    expect(screen.getByRole('heading', { name: 'Create your first goal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New goal' })).toBeInTheDocument();
  });

  it('shows a loading state until the workspace connects', () => {
    const transport: TransportClient = {
      status: 'connecting',
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendCommand: vi.fn(),
      subscribe: () => () => {},
      onStatusChange: () => () => {},
    };
    renderShell(transport);
    expect(screen.getByLabelText('Loading goals')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a reconnecting banner when the connection drops', async () => {
    let emitStatus: (s: 'reconnecting') => void = () => {};
    const transport: TransportClient = {
      status: 'open',
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendCommand: vi.fn(),
      subscribe: () => () => {},
      onStatusChange: (l) => {
        emitStatus = l;
        return () => {};
      },
    };
    renderShell(transport);
    emitStatus('reconnecting');
    expect(await screen.findByText('Connection lost. Reconnecting…')).toBeInTheDocument();
  });

  it('reports failed commands and signs out when the session has expired', async () => {
    const onSessionExpired = vi.fn();
    const transport = new DemoTransport({ workspaceId: 'northwind', latency: 0 });
    vi.spyOn(transport, 'sendCommand')
      .mockRejectedValueOnce(new TransportError('server', 'Proba is having trouble right now. Please try again.'))
      .mockRejectedValueOnce(new TransportError('unauthorized', 'expired', 401));
    renderShell(transport, 0, { onSessionExpired });

    await userEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
    expect(await screen.findByText("We couldn't complete that request")).toBeInTheDocument();
    expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it('records an approval decision from the Approvals page', async () => {
    window.location.hash = '#/approvals';
    const transport = new DemoTransport({ workspaceId: 'northwind', latency: 0 });
    const send = vi.spyOn(transport, 'sendCommand');
    renderShell(transport);
    expect(screen.getByRole('heading', { name: 'Approvals', level: 1 })).toBeInTheDocument();
    const card = screen.getByRole('region', { name: /Approval required: Move more daily budget to variant B/ });
    await userEvent.click(within(card).getByRole('button', { name: 'Approve' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'answer_ask', payload: expect.objectContaining({ choice: 'approve' }) }));
  });

  describe('pause and emergency stop reflect the Hub', () => {
    it('does not show a pause until the Hub confirms it, then follows the persisted state', async () => {
      const { transport, emitStatus } = hubTransport();
      renderShell(transport);

      await userEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
      expect(transport.sendCommand).toHaveBeenCalledWith(expect.objectContaining({ type: 'control', payload: { action: 'pause' } }));
      expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Resume all activity' })).not.toBeInTheDocument();

      emitStatus({ state: 'pause', executionState: 'paused', message: 'Execution pause' });
      expect(await screen.findByText('All activity is paused')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resume all activity' })).toBeInTheDocument();
      expect(await screen.findByText('All activity paused')).toBeInTheDocument(); // toast, shown on confirmation

      emitStatus({ state: 'resume', executionState: 'running', message: 'Execution resume' });
      await waitFor(() => expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument());
    });

    it('does not show an emergency stop until the Hub confirms it', async () => {
      const { transport, emitStatus } = hubTransport();
      renderShell(transport);

      await userEvent.click(screen.getByRole('button', { name: 'Emergency stop: halt all campaigns' }));
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Stop all campaigns' }));
      expect(screen.queryByText('Emergency stop engaged')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Emergency stop: halt all campaigns' })).toBeDisabled(); // still waiting: loading

      emitStatus({ state: 'kill', executionState: 'stopped', message: 'Execution kill' });
      expect(await screen.findByRole('button', { name: 'Resume operations' })).toBeInTheDocument();
      expect(screen.getAllByText('Emergency stop engaged').length).toBeGreaterThan(0);
    });

    it('shows a state the Hub reports without any button press (another tab, or replay after reconnect)', async () => {
      const { transport, emitStatus } = hubTransport();
      renderShell(transport);
      emitStatus({ state: 'kill', executionState: 'stopped', message: 'Execution kill' });
      expect(await screen.findByRole('button', { name: 'Resume operations' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Emergency stop: halt all campaigns' })).toBeDisabled();
    });

    it('keeps the last confirmed state and says so when the Hub never confirms', () => {
      vi.useFakeTimers();
      try {
        const { transport } = hubTransport();
        renderShell(transport);
        fireEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
        act(() => {
          vi.advanceTimersByTime(CONTROL_CONFIRM_TIMEOUT_MS + 1);
        });
        expect(screen.getByText('Waiting for Proba to confirm')).toBeInTheDocument();
        expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pause all activity' })).toBeEnabled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports a control the Hub refuses (202 with status rejected) and changes nothing', async () => {
      const { transport } = hubTransport();
      vi.mocked(transport.sendCommand).mockRejectedValueOnce(new TransportError('rejected', 'This request was not accepted.', 202));
      renderShell(transport);
      await userEvent.click(screen.getByRole('button', { name: 'Pause all activity' }));
      expect(await screen.findByText("We couldn't complete that request")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pause all activity' })).toBeEnabled();
      expect(screen.queryByText('All activity is paused')).not.toBeInTheDocument();
    });
  });
});
