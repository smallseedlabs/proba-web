import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/toast';
import type { IncomingEvent, TransportClient } from '../lib/transport/types';
import { WorkspaceProvider, useWorkspace } from './workspace';

function TestConsumer({ askEvent }: { askEvent: IncomingEvent }) {
  const { respond } = useWorkspace();
  return (
    <div>
      <button type="button" onClick={() => void respond(askEvent, { id: 'approve' })}>
        Approve
      </button>
      <button type="button" onClick={() => void respond(askEvent, { id: 'reject' })}>
        Reject
      </button>
    </div>
  );
}

describe('H0-02b approval-token minting on explicit user click', () => {
  const makeEvent = (askType: string, askId: string): IncomingEvent => ({
    kind: 'event',
    seq: 1,
    threadId: 'thread-1',
    type: 'ask',
    at: '2026-11-21T12:00:00.000Z',
    payload: {
      askId,
      askType,
      title: 'Launch campaign',
      risk: 'high',
      costEffect: { dailyUsd: 25 },
      questions: [],
    },
  });

  const makeTransport = () => {
    const sendCommand = vi.fn(async () => {});
    const mintApprovalToken = vi.fn(async (askId: string) => `tok-${askId}-1234567890abcdef`);
    const client: TransportClient = {
      sendCommand,
      mintApprovalToken,
      subscribe: () => () => {},
      onStatusChange: () => () => {},
      status: 'open',
      connect: () => {},
      disconnect: () => {},
    };
    return { client, sendCommand, mintApprovalToken };
  };

  it('never pre-fetches approval-token on render and mints only on explicit spend-approval click', async () => {
    const { client, sendCommand, mintApprovalToken } = makeTransport();
    const askEvent = makeEvent('plan_approval', 'ask-plan-1');

    render(
      <ToastProvider>
        <WorkspaceProvider transport={client} onSessionExpired={() => {}}>
          <TestConsumer askEvent={askEvent} />
        </WorkspaceProvider>
      </ToastProvider>
    );

    expect(mintApprovalToken).not.toHaveBeenCalled();
    expect(sendCommand).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByText('Approve').click();
    });

    expect(mintApprovalToken).toHaveBeenCalledTimes(1);
    expect(mintApprovalToken).toHaveBeenCalledWith('ask-plan-1');
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'answer_ask',
        payload: expect.objectContaining({
          askId: 'ask-plan-1',
          choice: 'approve',
          approvalToken: 'tok-ask-plan-1-1234567890abcdef',
        }),
      })
    );
  });

  it('does not mint approval-token on reject or non-spend clarify asks', async () => {
    const { client, sendCommand, mintApprovalToken } = makeTransport();

    const { rerender } = render(
      <ToastProvider>
        <WorkspaceProvider transport={client} onSessionExpired={() => {}}>
          <TestConsumer askEvent={makeEvent('action_approval', 'ask-act-1')} />
        </WorkspaceProvider>
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Reject').click();
    });
    expect(mintApprovalToken).not.toHaveBeenCalled();
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'answer_ask',
        payload: expect.objectContaining({ askId: 'ask-act-1', choice: 'reject' }),
      })
    );

    rerender(
      <ToastProvider>
        <WorkspaceProvider transport={client} onSessionExpired={() => {}}>
          <TestConsumer askEvent={makeEvent('clarify', 'ask-clarify-1')} />
        </WorkspaceProvider>
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Approve').click();
    });
    expect(mintApprovalToken).not.toHaveBeenCalled();
  });
});
