import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import { ToastProvider } from '../ui/toast';
import { WorkspaceProvider } from '../../state/workspace';
import { NewGoalDialog } from './NewGoalDialog';

function renderDialog() {
  const sendCommand = vi.fn().mockResolvedValue(undefined);
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand,
    subscribe: (listener) => {
      const ready: IncomingEvent = {
        kind: 'event',
        seq: 0,
        at: '2026-11-08T17:00:00Z',
        type: 'status',
        payload: { state: 'idle' },
      };
      listener(ready);
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
        <NewGoalDialog open onClose={vi.fn()} />
      </WorkspaceProvider>
    </ToastProvider>
  );
  return { sendCommand };
}

describe('NewGoalDialog landing URL', () => {
  it('has a blank landing URL with no default destination and omits userSuppliedInput when left empty', async () => {
    const { sendCommand } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Create a goal' });
    const landing = within(dialog).getByLabelText(/Landing page URL/);
    expect(landing).toHaveValue('');
    expect(landing).not.toHaveAttribute('value', expect.stringMatching(/smallseedlabs/i));
    expect(dialog).not.toHaveTextContent(/smallseedlabs\.com/i);

    await userEvent.type(within(dialog).getByLabelText(/^Goal/), 'Test demand in Germany');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));

    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create_goal',
        payload: { title: 'Test demand in Germany' },
      })
    );
    const payload = sendCommand.mock.calls[0][0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty('userSuppliedInput');
    expect(JSON.stringify(payload)).not.toMatch(/smallseedlabs/i);
  });

  it('passes the operator URL through create_goal and rejects a malformed URL', async () => {
    const { sendCommand } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Create a goal' });
    await userEvent.type(within(dialog).getByLabelText(/^Goal/), 'Launch');
    await userEvent.type(within(dialog).getByLabelText(/Landing page URL/), 'javascript:alert(1)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    expect(sendCommand).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/http or https|valid absolute URL|credentials/i)).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText(/Landing page URL/));
    await userEvent.type(within(dialog).getByLabelText(/Landing page URL/), 'https://operator-entered.example/path');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create goal' }));
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create_goal',
        payload: {
          title: 'Launch',
          userSuppliedInput: { landingPageUrl: 'https://operator-entered.example/path' },
        },
      })
    );
  });
});
