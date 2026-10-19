import type { ConnectionStatus, IncomingEvent, OutgoingCommand, TransportClient } from '../transport';
import { ASKS, GOALS, THREADS, buildSeed, launchPlanEvent } from './seed';

type Draft = Omit<IncomingEvent, 'seq' | 'kind' | 'at'>;

export interface DemoTransportOptions {
  workspaceId: string;
  /** Multiplier for simulated latency; 0 makes the transport synchronous (tests). */
  latency?: number;
  now?: () => Date;
}

/**
 * Development-only transport that simulates proba-hub with realistic data. It
 * is only bundled when VITE_DEMO_MODE=true.
 */
export class DemoTransport implements TransportClient {
  private listeners = new Set<(event: IncomingEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private seq = 0;
  private _status: ConnectionStatus = 'closed';
  private readonly latency: number;
  private readonly now: () => Date;

  constructor(private readonly options: DemoTransportOptions) {
    this.latency = options.latency ?? 1;
    this.now = options.now ?? (() => new Date());
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(): void {
    if (this._status === 'open' || this._status === 'connecting') return;
    this.setStatus('connecting');
    this.later(350, () => {
      if (this.options.workspaceId === 'northwind') {
        const now = this.now();
        for (const seed of buildSeed(now)) {
          const { minutesAgo, ...draft } = seed;
          this.emit(draft, new Date(now.getTime() - minutesAgo * 60_000));
        }
      }
      this.setStatus('open');
    });
  }

  disconnect(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.setStatus('closed');
  }

  async sendCommand(command: OutgoingCommand): Promise<void> {
    this.later(150, () => this.emit({ type: 'ack', threadId: command.threadId, payload: { clientMsgId: command.clientMsgId, processed: true } }));
    const payload = command.payload ?? {};

    switch (command.type) {
      case 'answer_ask':
        this.handleAnswer(String(payload.askId), String(payload.choice), command.threadId);
        break;
      case 'approve_plan':
        this.resolve(ASKS.launchPlan, 'approve', THREADS.jacket, 'Ridgeline spring launch plan approved.');
        this.later(700, () =>
          this.emit({
            type: 'status',
            threadId: THREADS.jacket,
            payload: { state: 'executing', message: 'Producing ad creative', progress: { current: 1, total: 4 } },
            ui: { component: 'status_banner', version: '1.0.0', props: { status: 'executing', message: 'Producing ad creative', progress: 12 } },
            fallbackText: 'Producing ad creative.',
          })
        );
        this.later(900, () =>
          this.emit({
            type: 'goal_updated',
            threadId: THREADS.jacket,
            payload: { goalId: GOALS.jacket, status: 'active', progress: { completed: 1, total: 4 } },
            ui: { component: 'goal_summary', version: '1.0.0', props: { title: 'Spring launch: Ridgeline rain jacket', status: 'active', progress: 25, metrics: { spend: 0, budget: 5000, currency: 'USD' } } },
            fallbackText: 'Ridgeline launch is 25% complete.',
          })
        );
        this.later(1100, () =>
          this.message(THREADS.jacket, 'Plan approved. I am producing the three creative variants now and will ask for your approval again before any spend goes live.')
        );
        break;
      case 'send_message':
        this.later(900, () =>
          this.message(command.threadId, 'Thanks, noted. I will take that into account and update you in this thread.')
        );
        break;
      case 'create_goal': {
        const title = String(payload.title ?? 'New goal');
        const id = `${Date.now()}`;
        const threadId = `t-${id}`;
        this.later(400, () =>
          this.emit({
            type: 'goal_updated',
            threadId,
            payload: { goalId: `g-${id}`, status: 'active', progress: { completed: 0, total: 1 } },
            ui: { component: 'goal_summary', version: '1.0.0', props: { title, status: 'active', progress: 0, metrics: { spend: 0, budget: (payload.budget as { daily?: number } | undefined)?.daily ?? 0, currency: 'USD' } } },
            fallbackText: title,
          })
        );
        this.later(800, () => this.message(threadId, `I am drafting a plan for “${title}”. I will share it here for your approval before anything goes live.`));
        break;
      }
      default:
        break;
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

  private handleAnswer(askId: string, choice: string, threadId?: string): void {
    if (askId === ASKS.audience) {
      this.resolve(askId, 'approve', THREADS.jacket, 'Audience selected.');
      this.later(500, () =>
        this.message(THREADS.jacket, 'Got it. I have drafted a launch plan around that audience. Please review it below.')
      );
      this.later(900, () => this.emit(launchPlanEvent()));
    } else if (askId === ASKS.launchPlan) {
      this.resolve(askId, choice, THREADS.jacket, choice === 'reject' ? 'Plan declined.' : 'Changes requested.');
      this.later(600, () =>
        this.message(
          THREADS.jacket,
          choice === 'reject'
            ? 'Understood. I have set the plan aside. Tell me what you would like to change and I will prepare a new one.'
            : 'Of course. What would you like me to change? Reply here and I will revise the plan.'
        )
      );
    } else if (askId === ASKS.budgetShift) {
      this.resolve(askId, choice, THREADS.boot, choice === 'reject' ? 'Budget change declined.' : 'Budget change approved.');
      this.later(600, () =>
        this.message(
          THREADS.boot,
          choice === 'reject'
            ? 'Understood. I will keep the current budget split and continue monitoring.'
            : 'Done. Variant B now receives $65 per day. I will report the impact within 48 hours.'
        )
      );
    } else {
      this.resolve(askId, choice, threadId, 'Request answered.');
    }
  }

  private resolve(askId: string, choice: string, threadId: string | undefined, text: string): void {
    this.later(300, () =>
      this.emit({ type: 'ask_resolved', threadId, payload: { askId, resolution: 'answered', answer: { choice } }, fallbackText: text })
    );
  }

  private message(threadId: string | undefined, text: string): void {
    this.emit({ type: 'message', threadId, payload: { text, source: 'brain' }, fallbackText: text });
  }

  private emit(draft: Draft, at: Date = this.now()): void {
    const event: IncomingEvent = { kind: 'event', seq: ++this.seq, at: at.toISOString(), ...draft };
    this.listeners.forEach((listener) => listener(event));
  }

  private later(ms: number, fn: () => void): void {
    if (this.latency === 0) {
      fn();
      return;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms * this.latency);
    this.timers.add(timer);
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this._status) return;
    this._status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}
