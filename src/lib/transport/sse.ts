import { TransportError, type ConnectionStatus, type IncomingEvent, type OutgoingCommand, type TransportClient } from './types';

export interface SSETransportOptions {
  apiBaseUrl: string;
  /** Bearer token issued at sign-in. */
  token?: string;
  onError?: (error: Error) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Hub transport: events over Server-Sent Events (GET /v1/events) and commands
 * over REST (POST /v1/commands). Reconnects with exponential back-off and
 * de-duplicates events by sequence number.
 */
export class SSETransport implements TransportClient {
  private eventSource: EventSource | null = null;
  private listeners = new Set<(event: IncomingEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private seenSeqs = new Set<number>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private hasOpened = false;
  private _status: ConnectionStatus = 'closed';

  constructor(private readonly options: SSETransportOptions) {}

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = new URL('/v1/events', this.options.apiBaseUrl);
    if (this.options.token) {
      // EventSource cannot send headers; the Hub accepts the token as a query parameter.
      url.searchParams.set('token', this.options.token);
    }
    this.setStatus(this.hasOpened ? 'reconnecting' : 'connecting');
    this.eventSource = new EventSource(url.toString());

    this.eventSource.addEventListener('message', (e: MessageEvent) => {
      try {
        this.handleEvent(JSON.parse(e.data) as IncomingEvent);
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.eventSource.addEventListener('error', () => {
      this.scheduleReconnect();
    });

    this.eventSource.addEventListener('open', () => {
      this.hasOpened = true;
      this.reconnectDelay = 1000;
      this.setStatus('open');
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('closed');
  }

  async sendCommand(command: OutgoingCommand): Promise<void> {
    const url = new URL('/v1/commands', this.options.apiBaseUrl);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }

    let response: Response;
    try {
      const doFetch = this.options.fetchImpl ?? fetch;
      response = await doFetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(command),
      });
    } catch {
      throw new TransportError('network', "We couldn't reach Proba. Check your connection and try again.");
    }

    if (response.status === 401) {
      throw new TransportError('unauthorized', 'Your session has expired. Please sign in again.', 401);
    }
    if (response.status >= 400 && response.status < 500) {
      throw new TransportError('rejected', 'This request was not accepted.', response.status);
    }
    if (!response.ok) {
      throw new TransportError('server', 'Proba is having trouble right now. Please try again.', response.status);
    }
  }

  subscribe(onEvent: (event: IncomingEvent) => void): () => void {
    this.listeners.add(onEvent);
    return () => {
      this.listeners.delete(onEvent);
    };
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this._status) return;
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private handleEvent(event: IncomingEvent): void {
    if (this.seenSeqs.has(event.seq)) {
      return;
    }
    this.seenSeqs.add(event.seq);

    if (this.seenSeqs.size > 1000) {
      const sorted = Array.from(this.seenSeqs).sort((a, b) => a - b);
      this.seenSeqs = new Set(sorted.slice(-500));
    }

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.eventSource?.close();
    this.eventSource = null;
    this.setStatus(this.hasOpened ? 'reconnecting' : 'connecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }
}
