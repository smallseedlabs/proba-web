import type { ControlAction } from '../lib/protocol';
import type { ConnectionStatus, IncomingEvent } from '../lib/transport';
import type { AskDecision, LocalMessage } from './selectors';

export type OperationsState = 'running' | 'paused' | 'stopped';

const OPERATIONS_STATES: readonly OperationsState[] = ['running', 'paused', 'stopped'];

/**
 * The execution state the Hub persists and reports on every control status event
 * (payload.executionState). Anything else, including status events that are not about
 * control, carries no execution state.
 */
export function executionStateOf(event: IncomingEvent): OperationsState | null {
  if (event.type !== 'status') return null;
  const value = (event.payload as { executionState?: unknown }).executionState;
  return OPERATIONS_STATES.includes(value as OperationsState) ? (value as OperationsState) : null;
}

/** A control command the Hub has applied: what was asked and the state it left the workspace in. */
export interface ControlOutcome {
  seq: number;
  action?: string;
  executionState: OperationsState;
}

export interface WorkspaceState {
  events: IncomingEvent[];
  connection: ConnectionStatus;
  hasLoaded: boolean;
  localMessages: LocalMessage[];
  decisions: Record<string, AskDecision>;
  operations: OperationsState;
  pendingControl: ControlAction | null;
  /** The latest control the Hub confirmed in this session's event stream (null until one arrives). */
  lastControl: ControlOutcome | null;
}

type Action =
  | { type: 'event'; event: IncomingEvent }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'local_message'; message: LocalMessage }
  | { type: 'local_message_status'; clientMsgId: string; status: LocalMessage['status'] }
  | { type: 'decision'; askId: string; decision: AskDecision | null }
  | { type: 'control_pending'; action: ControlAction | null };

export const initialWorkspaceState: WorkspaceState = {
  events: [],
  connection: 'connecting',
  hasLoaded: false,
  localMessages: [],
  decisions: {},
  operations: 'running',
  pendingControl: null,
  lastControl: null,
};

export function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'event': {
      if (state.events.some((e) => e.seq === action.event.seq)) return state;
      let localMessages = state.localMessages;
      if (action.event.type === 'ack') {
        const clientMsgId = (action.event.payload as { clientMsgId?: string }).clientMsgId;
        localMessages = localMessages.map((m) => (m.clientMsgId === clientMsgId ? { ...m, status: 'sent' } : m));
      }
      // The Hub is the source of truth for pause / emergency stop: events (live or replayed on
      // reconnect) set the state, the UI never assumes it from a button press.
      const executionState = executionStateOf(action.event);
      const control: Partial<WorkspaceState> = executionState
        ? {
            operations: executionState,
            pendingControl: null,
            lastControl: {
              seq: action.event.seq,
              action: (action.event.payload as { state?: string }).state,
              executionState,
            },
          }
        : {};
      return { ...state, ...control, events: [...state.events, action.event], localMessages, hasLoaded: true };
    }
    case 'connection':
      return { ...state, connection: action.status, hasLoaded: state.hasLoaded || action.status === 'open' };
    case 'local_message':
      return { ...state, localMessages: [...state.localMessages, action.message] };
    case 'local_message_status':
      return {
        ...state,
        localMessages: state.localMessages.map((m) =>
          m.clientMsgId === action.clientMsgId ? { ...m, status: action.status } : m
        ),
      };
    case 'decision': {
      const decisions = { ...state.decisions };
      if (action.decision) decisions[action.askId] = action.decision;
      else delete decisions[action.askId];
      return { ...state, decisions };
    }
    case 'control_pending':
      return { ...state, pendingControl: action.action };
    default:
      return state;
  }
}

