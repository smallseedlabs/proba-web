import type { TransportClient } from './types';
import happyPathFixture from './happy-path-conversation.json';

interface ConversationStep {
  response?: {
    kind: string;
    seq: number;
    type: string;
    payload: unknown;
    at: string;
    threadId?: string;
  };
  event?: {
    kind: string;
    seq: number;
    type: string;
    payload: unknown;
    at: string;
    threadId?: string;
    ui?: unknown;
    fallbackText?: string;
  };
}

interface FixtureData {
  conversation: ConversationStep[];
}

export class MockTransport implements TransportClient {
  private listeners: Set<(event: unknown) => void> = new Set();
  private connected = false;
  private currentStep = 0;

  connect(): void {
    if (this.connected) return;
    this.connected = true;

    setTimeout(() => {
      this.replayFixture();
    }, 500);
  }

  disconnect(): void {
    this.connected = false;
  }

  async sendCommand(command: unknown): Promise<void> {
    console.log('Mock: received command', command);
    
    setTimeout(() => {
      this.advanceFixture();
    }, 300);
  }

  subscribe(onEvent: (event: unknown) => void): () => void {
    this.listeners.add(onEvent);
    return () => {
      this.listeners.delete(onEvent);
    };
  }

  private replayFixture(): void {
    const steps = (happyPathFixture as FixtureData).conversation;
    
    const initialEvents = steps
      .slice(0, 2)
      .flatMap((step) => [step.response, step.event].filter(Boolean));

    initialEvents.forEach((event, index) => {
      if (event) {
        setTimeout(() => {
          this.emitEvent(event);
        }, index * 500);
      }
    });

    this.currentStep = 2;
  }

  private advanceFixture(): void {
    const steps = (happyPathFixture as FixtureData).conversation;
    
    if (this.currentStep >= steps.length) {
      return;
    }

    const step = steps[this.currentStep];
    const events = [step.response, step.event].filter(Boolean);

    events.forEach((event, index) => {
      if (event) {
        setTimeout(() => {
          this.emitEvent(event);
        }, index * 500);
      }
    });

    this.currentStep++;
  }

  private emitEvent(event: unknown): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Mock event listener error:', error);
      }
    });
  }
}
