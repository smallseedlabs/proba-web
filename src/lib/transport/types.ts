import type { CommandEnvelope, EventEnvelope } from '../protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type OutgoingCommand = CommandEnvelope<Record<string, unknown>>;
export type IncomingEvent = EventEnvelope<Record<string, unknown>>;

export class TransportError extends Error {
  constructor(
    public readonly code: 'unauthorized' | 'rejected' | 'network' | 'server',
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface TransportClient {
  sendCommand(command: OutgoingCommand): Promise<void>;
  subscribe(onEvent: (event: IncomingEvent) => void): () => void;
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void;
  readonly status: ConnectionStatus;
  connect(): void;
  disconnect(): void;
}
