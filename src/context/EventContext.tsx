import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useTransport } from './TransportContext';

interface EventData {
  kind: string;
  seq: number;
  type: string;
  threadId?: string;
  payload: Record<string, unknown>;
}

interface EventState {
  events: EventData[];
  pendingCommands: Set<string>;
  addPendingCommand: (clientMsgId: string) => void;
  removePendingCommand: (clientMsgId: string) => void;
}

const EventContext = createContext<EventState | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const transport = useTransport();
  const [events, setEvents] = useState<EventData[]>([]);
  const [pendingCommands, setPendingCommands] = useState<Set<string>>(new Set());

  const addPendingCommand = useCallback((clientMsgId: string) => {
    setPendingCommands((prev) => new Set(prev).add(clientMsgId));
  }, []);

  const removePendingCommand = useCallback((clientMsgId: string) => {
    setPendingCommands((prev) => {
      const next = new Set(prev);
      next.delete(clientMsgId);
      return next;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = transport.subscribe((event) => {
      setEvents((prev) => [...prev, event as EventData]);

      if ((event as EventData).type === 'ack') {
        const ackPayload = (event as EventData).payload as { clientMsgId?: string };
        if (ackPayload.clientMsgId) {
          removePendingCommand(ackPayload.clientMsgId);
        }
      }
    });

    return unsubscribe;
  }, [transport, removePendingCommand]);

  return (
    <EventContext.Provider
      value={{ events, pendingCommands, addPendingCommand, removePendingCommand }}
    >
      {children}
    </EventContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvents(): EventState {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within EventProvider');
  }
  return context;
}
