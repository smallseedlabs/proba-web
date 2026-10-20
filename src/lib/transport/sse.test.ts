import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSETransport } from './sse';
import type { OutgoingCommand } from './types';

type Handler = (e?: unknown) => void;

describe('SSETransport', () => {
  let transport: SSETransport;
  let handlers: Record<string, Handler>;
  let mockEventSource: { addEventListener: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let EventSourceMock: ReturnType<typeof vi.fn>;

  const command: OutgoingCommand = {
    kind: 'command',
    clientMsgId: 'c-123',
    type: 'send_message',
    payload: { text: 'Hello' },
    sentAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    handlers = {};
    mockEventSource = {
      addEventListener: vi.fn((name: string, fn: Handler) => {
        handlers[name] = fn;
      }),
      close: vi.fn(),
    };
    EventSourceMock = vi.fn(() => mockEventSource);
    global.EventSource = EventSourceMock as unknown as typeof EventSource;
    transport = new SSETransport({ apiBaseUrl: 'http://hub.test', token: 'tok-1' });
  });

  afterEach(() => {
    transport.disconnect();
    vi.useRealTimers();
  });

  it('connects to the event stream with the session token', () => {
    transport.connect();
    expect(EventSourceMock).toHaveBeenCalledWith('http://hub.test/v1/events?token=tok-1');
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(transport.status).toBe('connecting');
  });

  it('listens for every named protocol event type the Hub sends', () => {
    const onEvent = vi.fn();
    transport.subscribe(onEvent);
    transport.connect();
    for (const type of ['ask', 'ask_resolved', 'status', 'alert', 'goal_updated', 'ack']) {
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith(type, expect.any(Function));
    }

    const ask = { kind: 'event', seq: 1, type: 'ask', payload: { askId: 'a' }, at: '2026-01-01T00:00:00Z' };
    const goal = { kind: 'event', seq: 2, type: 'goal_updated', payload: { goalId: 'g' }, at: '2026-01-01T00:00:00Z' };
    handlers.ask({ data: JSON.stringify(ask) });
    handlers.goal_updated({ data: JSON.stringify(goal) });
    expect(onEvent).toHaveBeenNthCalledWith(1, ask);
    expect(onEvent).toHaveBeenNthCalledWith(2, goal);
  });

  it('treats an error event with data as a protocol error, not a disconnect', () => {
    const onEvent = vi.fn();
    transport.subscribe(onEvent);
    transport.connect();
    const err = { kind: 'event', seq: 3, type: 'error', payload: { message: 'boom' }, at: '2026-01-01T00:00:00Z' };
    handlers.error({ data: JSON.stringify(err) });
    expect(onEvent).toHaveBeenCalledWith(err);
    expect(transport.status).toBe('connecting');
    vi.advanceTimersByTime(1000);
    expect(EventSourceMock).toHaveBeenCalledTimes(1);
  });

  it('delivers events once and de-duplicates by sequence number', () => {
    const onEvent = vi.fn();
    transport.subscribe(onEvent);
    transport.connect();

    const event = { kind: 'event', seq: 1, type: 'message', payload: { text: 'Hello' }, at: '2026-01-01T00:00:00Z' };
    handlers.message({ data: JSON.stringify(event) });
    handlers.message({ data: JSON.stringify(event) });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('stops delivering events after unsubscribe', () => {
    const onEvent = vi.fn();
    const unsubscribe = transport.subscribe(onEvent);
    transport.connect();
    handlers.message({ data: JSON.stringify({ kind: 'event', seq: 1, type: 'message', payload: {}, at: '' }) });
    unsubscribe();
    handlers.message({ data: JSON.stringify({ kind: 'event', seq: 2, type: 'message', payload: {}, at: '' }) });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('reports parse errors without throwing', () => {
    const onError = vi.fn();
    transport = new SSETransport({ apiBaseUrl: 'http://hub.test', onError });
    transport.connect();
    expect(() => handlers.message({ data: '{not json' })).not.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  it('moves through connecting, open and reconnecting states with back-off', () => {
    const statuses: string[] = [];
    transport.onStatusChange((s) => statuses.push(s));
    transport.connect();
    handlers.open();
    handlers.error();
    expect(transport.status).toBe('reconnecting');
    expect(EventSourceMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(EventSourceMock).toHaveBeenCalledTimes(2);
    handlers.open();
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'open']);
  });

  it('sends commands with the bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    transport = new SSETransport({ apiBaseUrl: 'http://hub.test', token: 'tok-1', fetchImpl });

    await transport.sendCommand(command);

    expect(fetchImpl).toHaveBeenCalledWith('http://hub.test/v1/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-1' },
      body: JSON.stringify(command),
    });
  });

  it.each([
    [401, 'unauthorized'],
    [422, 'rejected'],
    [500, 'server'],
  ])('maps a %i command response to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status });
    transport = new SSETransport({ apiBaseUrl: 'http://hub.test', fetchImpl });
    await expect(transport.sendCommand(command)).rejects.toMatchObject({ code });
  });

  it('maps fetch failures to a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    transport = new SSETransport({ apiBaseUrl: 'http://hub.test', fetchImpl });
    await expect(transport.sendCommand(command)).rejects.toMatchObject({ code: 'network' });
  });
});
