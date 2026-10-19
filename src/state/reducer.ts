import type { ControlAction } from '../lib/protocol';
import type { ConnectionStatus, IncomingEvent } from '../lib/transport';
import type { AskDecision, LocalMessage } from './selectors';

export type OperationsState = 'running' | 'paused' | 'stopped';

export interface WorkspaceState {
  events: IncomingEvent[];
  connection: ConnectionStatus;
  hasLoaded: boolean;
  localMessages: LocalMessage[];
  decisions: Record<string, AskDecision>;
  operations: OperationsState;
  pendingControl: ControlAction | null;
}

type Action =
  | { type: 'event'; event: IncomingEvent }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'local_message'; message: LocalMessage }
  | { type: 'local_message_status'; clientMsgId: string; status: LocalMessage['status'] }
  | { type: 'decision'; askId: string; decision: AskDecision | null }
  | { type: 'control_pending'; action: ControlAction | null }
  | { type: 'operations'; state: OperationsState };

export const initialWorkspaceState: WorkspaceState = {
  events: [],
  connection: 'connecting',
  hasLoaded: false,
  localMessages: [],
  decisions: {},
  operations: 'running',
  pendingControl: null,
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
      return { ...state, events: [...state.events, action.event], localMessages, hasLoaded: true };
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
    case 'operations':
      return { ...state, operations: action.state };
    default:
      return state;
  }
}

