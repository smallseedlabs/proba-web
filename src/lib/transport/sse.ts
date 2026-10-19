import type { TransportClient } from './types';

interface EventData {
  kind: string;
  seq: number;
  type: string;
  payload: unknown;
  at: string;
  threadId?: string;
}

export class SSETransport implements TransportClient {
  private eventSource: EventSource | null = null;
  private listeners: Set<(event: EventData) => void> = new Set();
  private seenSeqs: Set<number> = new Set();
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  constructor(private options: { apiBaseUrl: string; onReconnect?: () => void; onError?: (error: Error) => void }) {}

  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = new URL('/v1/events', this.options.apiBaseUrl);
    this.eventSource = new EventSource(url.toString());

    this.eventSource.addEventListener('message', (e) => {
      try {
        const event = JSON.parse(e.data) as EventData;
        this.handleEvent(event);
      } catch (error) {
        console.error('Failed to parse event:', error);
        this.options.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });

    this.eventSource.addEventListener('error', () => {
      this.reconnect();
    });

    this.eventSource.addEventListener('open', () => {
      this.reconnectDelay = 1000;
      this.options.onReconnect?.();
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
  }

  async sendCommand(command: unknown): Promise<void> {
    const url = new URL('/v1/commands', this.options.apiBaseUrl);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Command failed: ${response.status}`);
    }
  }

  subscribe(onEvent: (event: unknown) => void): () => void {
    this.listeners.add(onEvent as (event: EventData) => void);
    return () => {
      this.listeners.delete(onEvent as (event: EventData) => void);
    };
  }

  private handleEvent(event: EventData): void {
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
        console.error('Event listener error:', error);
      }
    });
  }

  private reconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }
}
