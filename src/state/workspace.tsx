import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { ControlAction } from '../lib/protocol';
import { TransportError, type IncomingEvent, type OutgoingCommand, type TransportClient } from '../lib/transport';
import { createId } from '../lib/utils/id';
import { useToast } from '../components/ui/toast';
import type { AskDecision } from './selectors';
import { initialWorkspaceState, workspaceReducer, type OperationsState, type WorkspaceState } from './reducer';
export type { OperationsState, WorkspaceState } from './reducer';
import { askPayload } from './selectors';

export interface ActionRequest {
  id: string;
  command?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

export interface WorkspaceApi {
  state: WorkspaceState;
  sendMessage(text: string, threadId?: string): Promise<boolean>;
  respond(event: IncomingEvent, request: ActionRequest): Promise<void>;
  control(action: ControlAction): Promise<boolean>;
  createGoal(input: { title: string; description?: string; dailyBudget?: number; currency: string }): Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

const ASK_CHOICES = ['approve', 'reject', 'edit'] as const;

export function WorkspaceProvider({
  transport,
  onSessionExpired,
  children,
}: {
  transport: TransportClient;
  onSessionExpired: () => void;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const { notify } = useToast();

  useEffect(() => {
    const offEvents = transport.subscribe((event) => dispatch({ type: 'event', event }));
    const offStatus = transport.onStatusChange((status) => dispatch({ type: 'connection', status }));
    transport.connect();
    dispatch({ type: 'connection', status: transport.status });
    return () => {
      offEvents();
      offStatus();
      transport.disconnect();
    };
  }, [transport]);

  const send = useCallback(
    async (type: OutgoingCommand['type'], payload: Record<string, unknown>, threadId?: string, clientMsgId = createId()) => {
      try {
        await transport.sendCommand({
          kind: 'command',
          clientMsgId,
          type,
          threadId,
          payload,
          sentAt: new Date().toISOString(),
        });
        return true;
      } catch (error) {
        if (error instanceof TransportError && error.code === 'unauthorized') {
          onSessionExpired();
          return false;
        }
        notify({
          tone: 'danger',
          title: "We couldn't complete that request",
          description: error instanceof Error ? error.message : 'Please try again.',
        });
        return false;
      }
    },
    [transport, notify, onSessionExpired]
  );

  const sendMessage = useCallback(
    async (text: string, threadId?: string) => {
      const clientMsgId = createId();
      dispatch({
        type: 'local_message',
        message: { clientMsgId, threadId, text, sentAt: new Date().toISOString(), status: 'sending' },
      });
      const ok = await send('send_message', { text }, threadId, clientMsgId);
      if (!ok) dispatch({ type: 'local_message_status', clientMsgId, status: 'failed' });
      return ok;
    },
    [send]
  );

  const respond = useCallback(
    async (event: IncomingEvent, request: ActionRequest) => {
      const ask = askPayload(event);
      const choice = (ASK_CHOICES as readonly string[]).includes(request.id)
        ? (request.id as AskDecision['choice'])
        : 'approve';
      if (ask) dispatch({ type: 'decision', askId: ask.askId, decision: { state: 'submitting', choice } });

      let ok: boolean;
      const command = request.command;
      if (command && typeof command.type === 'string') {
        ok = await send(
          command.type as OutgoingCommand['type'],
          (command.payload as Record<string, unknown>) ?? {},
          event.threadId
        );
      } else if (ask) {
        const values =
          request.values ?? ((ASK_CHOICES as readonly string[]).includes(request.id) ? undefined : { answer: request.id });
        ok = await send('answer_ask', { askId: ask.askId, choice, ...(values ? { values } : {}) }, event.threadId);
      } else {
        ok = true;
      }

      if (ask) {
        dispatch({ type: 'decision', askId: ask.askId, decision: ok ? { state: 'submitted', choice } : null });
        if (ok) {
          notify({
            tone: choice === 'reject' ? 'neutral' : 'success',
            title:
              ask.askType === 'clarify'
                ? 'Answer sent'
                : choice === 'reject'
                  ? 'Request declined'
                  : ask.askType === 'plan_approval'
                    ? 'Plan approved'
                    : 'Change approved',
            description: ask.title,
          });
        }
      }
    },
    [send, notify]
  );

  const control = useCallback(
    async (action: ControlAction) => {
      dispatch({ type: 'control_pending', action });
      const ok = await send('control', { action });
      dispatch({ type: 'control_pending', action: null });
      if (ok) {
        const next: OperationsState = action === 'pause' ? 'paused' : action === 'kill' ? 'stopped' : 'running';
        dispatch({ type: 'operations', state: next });
        notify({
          tone: action === 'kill' ? 'danger' : action === 'pause' ? 'warning' : 'success',
          title:
            action === 'kill'
              ? 'Emergency stop engaged'
              : action === 'pause'
                ? 'All activity paused'
                : 'Activity resumed',
          description:
            action === 'kill'
              ? 'All campaigns have been halted and no further spend will occur.'
              : action === 'pause'
                ? 'Proba will not launch or change campaigns until you resume.'
                : 'Proba is working on your goals again.',
        });
      }
      return ok;
    },
    [send, notify]
  );

  const createGoal = useCallback(
    async (input: { title: string; description?: string; dailyBudget?: number; currency: string }) => {
      const payload: Record<string, unknown> = { title: input.title };
      if (input.description) payload.description = input.description;
      if (input.dailyBudget) payload.budget = { daily: input.dailyBudget, currency: input.currency };
      const ok = await send('create_goal', payload);
      if (ok) {
        notify({ tone: 'success', title: 'Goal created', description: 'Proba is preparing a plan for your review.' });
      }
      return ok;
    },
    [send, notify]
  );

  const api = useMemo<WorkspaceApi>(
    () => ({ state, sendMessage, respond, control, createGoal }),
    [state, sendMessage, respond, control, createGoal]
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
