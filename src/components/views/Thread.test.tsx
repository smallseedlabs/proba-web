import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import { WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { ThreadView } from './Thread';

const SHA = '30c00e839b263e7ac7781d564ea02920a01672eaf29388a02d5bdeb9654607bb';
const URL = 'https://smallseedlabs.com/products/proba/';

function renderThread(events: IncomingEvent[]) {
  const transport: TransportClient = {
    status: 'open',
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendCommand: vi.fn(),
    subscribe: (l) => {
      events.forEach((e) => l(e));
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
        <ThreadView threadId="t1" userName="Alex Morgan" />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

describe('ThreadView wrapping', () => {
  it('wraps long unbroken strings in Proba and user messages so the column cannot overflow', () => {
    renderThread([
      {
        kind: 'event',
        seq: 1,
        at: '2026-11-14T02:30:00Z',
        type: 'message',
        threadId: 't1',
        payload: { source: 'assistant', text: `Source sha256 ${SHA} at ${URL}` },
      },
      {
        kind: 'event',
        seq: 2,
        at: '2026-11-14T02:31:00Z',
        type: 'message',
        threadId: 't1',
        payload: { source: 'user', text: URL },
      },
    ]);

    const conversation = screen.getByRole('list', { name: 'Conversation' });
    expect(conversation).toHaveClass('min-w-0');

    const assistantBody = screen.getByText(SHA, { exact: false }).closest('div.space-y-3');
    expect(assistantBody).toHaveClass('break-words', 'min-w-0', '[overflow-wrap:anywhere]');

    const userColumn = screen.getByText('You').closest('div.flex-col');
    expect(userColumn).toBeTruthy();
    const userText = within(userColumn as HTMLElement).getByText(URL);
    expect(userText.tagName).toBe('P');
    expect(userText).toHaveClass('break-words', '[overflow-wrap:anywhere]');
  });

  it('scrolls the thread overflow container and does not call scrollIntoView on the document', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const long = `Source sha256 ${SHA} at ${URL} `.repeat(20);
    const { container } = render(
      <div data-testid="thread-scroller" style={{ overflowY: 'auto', height: 80 }}>
        <ToastProvider>
          <WorkspaceProvider
            transport={{
              status: 'open',
              connect: vi.fn(),
              disconnect: vi.fn(),
              sendCommand: vi.fn(),
              subscribe: (l) => {
                l({
                  kind: 'event',
                  seq: 1,
                  at: '2026-11-14T02:30:00Z',
                  type: 'message',
                  threadId: 't1',
                  payload: { source: 'assistant', text: long },
                });
                return () => {};
              },
              onStatusChange: () => () => {},
            }}
            onSessionExpired={vi.fn()}
          >
            <ThreadView threadId="t1" userName="Alex Morgan" />
          </WorkspaceProvider>
        </ToastProvider>
      </div>
    );

    try {
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(document.documentElement.scrollTop).toBe(0);
      expect(container.querySelector('[aria-label="Conversation"]')).toBeTruthy();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});
