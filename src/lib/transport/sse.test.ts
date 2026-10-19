import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSETransport } from './sse';

describe('SSETransport', () => {
  let transport: SSETransport;
  let mockEventSource: {
    addEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    };

    global.EventSource = vi.fn(() => mockEventSource as unknown as EventSource) as unknown as typeof EventSource;
    global.fetch = vi.fn();

    transport = new SSETransport({
      apiBaseUrl: 'http://test.com',
    });
  });

  afterEach(() => {
    transport.disconnect();
  });

  it('connects and sets up event listeners', () => {
    transport.connect();

    expect(global.EventSource).toHaveBeenCalledWith('http://test.com/v1/events');
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
  });

  it('handles incoming events and deduplicates', () => {
    const onEvent = vi.fn();
    transport.subscribe(onEvent);
    transport.connect();

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      (call) => call[0] === 'message'
    )?.[1];

    const event = {
      kind: 'event' as const,
      seq: 1,
      type: 'message' as const,
      payload: { text: 'Hello' },
      at: new Date().toISOString(),
    };

    messageHandler?.({ data: JSON.stringify(event), lastEventId: '1' } as MessageEvent);
    expect(onEvent).toHaveBeenCalledWith(event);

    onEvent.mockClear();
    messageHandler?.({ data: JSON.stringify(event), lastEventId: '1' } as MessageEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('sends commands via POST', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });
    global.fetch = mockFetch;

    const command = {
      kind: 'command',
      clientMsgId: 'test-123',
      type: 'send_message',
      payload: { text: 'Hello' },
    };

    await transport.sendCommand(command);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test.com/v1/commands',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      }
    );
  });

  it('throws error when command fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });
    global.fetch = mockFetch;

    await expect(transport.sendCommand({})).rejects.toThrow('Command failed: 400');
  });

  it('disconnects and cleans up', () => {
    transport.connect();
    transport.disconnect();

    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('allows subscribing and unsubscribing', () => {
    const onEvent = vi.fn();
    const unsubscribe = transport.subscribe(onEvent);

    transport.connect();
    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      (call) => call[0] === 'message'
    )?.[1];

    const event = {
      kind: 'event' as const,
      seq: 1,
      type: 'message' as const,
      payload: {},
      at: new Date().toISOString(),
    };

    messageHandler?.({ data: JSON.stringify(event) } as MessageEvent);
    expect(onEvent).toHaveBeenCalledTimes(1);

    unsubscribe();
    messageHandler?.({ data: JSON.stringify({ ...event, seq: 2 }) } as MessageEvent);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
