import { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { useTransport } from '../../context/TransportContext';
import { ComponentRenderer } from '../registry';

interface ChatPanelProps {
  threadId: string | null;
}

interface EventWithUI {
  kind: string;
  seq: number;
  type: string;
  threadId?: string;
  payload: Record<string, unknown>;
  at?: string;
  ui?: {
    component: string;
    version: string;
    props: Record<string, unknown>;
    actions?: Array<{
      id: string;
      label: string;
      style?: 'primary' | 'secondary' | 'danger';
      opens?: string;
      command?: {
        type: string;
        payload: Record<string, unknown>;
      };
    }>;
  };
  fallbackText?: string;
}

export function ChatPanel({ threadId }: ChatPanelProps) {
  const { events, addPendingCommand, pendingCommands } = useEvents();
  const transport = useTransport();
  const [inputText, setInputText] = useState('');

  const threadEvents = events.filter(
    (e) => !threadId || e.threadId === threadId
  );

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const clientMsgId = crypto.randomUUID();
    addPendingCommand(clientMsgId);

    try {
      await transport.sendCommand({
        kind: 'command',
        clientMsgId,
        type: 'send_message',
        threadId: threadId || undefined,
        payload: {
          text: inputText,
        },
        sentAt: new Date().toISOString(),
      });
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAction = async (event: EventWithUI, actionId: string, command?: unknown) => {
    const clientMsgId = crypto.randomUUID();
    addPendingCommand(clientMsgId);

    try {
      if (command) {
        await transport.sendCommand({
          kind: 'command',
          clientMsgId,
          threadId: event.threadId || undefined,
          sentAt: new Date().toISOString(),
          ...command,
        });
      } else {
        const payload = event.payload as { askId?: string };
        await transport.sendCommand({
          kind: 'command',
          clientMsgId,
          type: 'answer_ask',
          threadId: event.threadId || undefined,
          payload: {
            askId: payload.askId,
            choice: actionId,
          },
          sentAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to send action:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-14 border-b bg-card flex items-center px-4">
        <h2 className="font-semibold">
          {threadId ? `Chat - ${threadId.slice(0, 8)}...` : 'Select a goal or start chatting'}
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {threadEvents.map((event) => {
          const eventWithUI = event as EventWithUI;
          const ui = eventWithUI.ui;
          const fallbackText = eventWithUI.fallbackText || '';
          
          if (event.type === 'ack') {
            return null;
          }

          return (
            <div key={event.seq} className="space-y-2">
              <div className="text-xs text-muted-foreground">
                #{event.seq} • {event.type} • {new Date(eventWithUI.at || '').toLocaleTimeString()}
              </div>
              {ui ? (
                <ComponentRenderer
                  ui={ui}
                  fallbackText={fallbackText}
                  onAction={(actionId, command) => handleAction(eventWithUI, actionId, command)}
                />
              ) : (
                <div className="p-3 rounded bg-muted">
                  {fallbackText || JSON.stringify(event.payload, null, 2)}
                </div>
              )}
            </div>
          );
        })}
        {pendingCommands.size > 0 && (
          <div className="text-sm text-muted-foreground">Sending...</div>
        )}
      </div>

      <div className="border-t bg-card p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded bg-background"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="px-4 py-2 rounded font-medium bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
