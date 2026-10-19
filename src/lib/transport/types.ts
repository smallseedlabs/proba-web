export interface TransportClient {
  sendCommand(command: unknown): Promise<void>;
  subscribe(onEvent: (event: unknown) => void): () => void;
  connect(): void;
  disconnect(): void;
}
