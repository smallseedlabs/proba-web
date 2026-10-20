import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { SendHorizontal } from 'lucide-react';
import type { MessagePayload } from '../../lib/protocol';
import type { IncomingEvent } from '../../lib/transport';
import { cn } from '../../lib/utils/cn';
import { formatRelativeTime, initials } from '../../lib/utils/format';
import { messageUI, selectThreadItems, type LocalMessage } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { LogoMark } from '../brand/Logo';
import { RichText } from '../registry/basic';
import { ComponentRenderer } from '../registry';
import { Button } from '../ui/button';
import { Callout } from '../ui/feedback';
import { AskCard } from './AskCard';

function AssistantMessage({ at, children }: { at: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-body font-semibold text-foreground">Proba</span>
          <time dateTime={at} className="text-caption text-muted-foreground">
            {formatRelativeTime(at)}
          </time>
        </p>
        <div className="mt-1 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function UserMessage({ text, at, userName, status }: { text: string; at: string; userName: string; status?: LocalMessage['status'] }) {
  return (
    <div className="flex flex-row-reverse gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-white" aria-hidden="true">
        {initials(userName)}
      </span>
      <div className="flex min-w-0 max-w-[75%] flex-col items-end">
        <p className="flex items-baseline gap-2">
          <time dateTime={at} className="text-caption text-muted-foreground">
            {status === 'sending' ? 'Sending…' : status === 'failed' ? 'Not delivered' : formatRelativeTime(at)}
          </time>
          <span className="text-body font-semibold text-foreground">You</span>
        </p>
        <div
          className={cn(
            'mt-1 rounded-2xl rounded-tr-sm px-4 py-2.5 text-body text-foreground',
            status === 'failed' ? 'border border-destructive/40 bg-destructive-subtle' : 'bg-primary-subtle'
          )}
        >
          <p className="whitespace-pre-line">{text}</p>
        </div>
      </div>
    </div>
  );
}

function EventItem({ event, userName }: { event: IncomingEvent; userName: string }) {
  const { respond } = useWorkspace();
  switch (event.type) {
    case 'ask':
      return (
        <AssistantMessage at={event.at}>
          <AskCard event={event} showTime={false} />
        </AssistantMessage>
      );
    case 'message': {
      const payload = event.payload as unknown as Partial<MessagePayload>;
      if (payload.source === 'user') {
        return <UserMessage text={payload.text ?? event.fallbackText ?? ''} at={event.at} userName={userName} />;
      }
      const ui = messageUI(event);
      return (
        <AssistantMessage at={event.at}>
          {payload.text && <RichText text={payload.text} />}
          {ui && <ComponentRenderer ui={ui as never} fallbackText={event.fallbackText ?? ''} onAction={(r) => respond(event, r)} />}
          {!payload.text && !ui && event.fallbackText && <RichText text={event.fallbackText} />}
        </AssistantMessage>
      );
    }
    case 'status':
    case 'alert':
      return (
        <div className="pl-10">
          {event.ui ? (
            <ComponentRenderer ui={event.ui as never} fallbackText={event.fallbackText ?? ''} />
          ) : (
            <Callout tone="info">{event.fallbackText}</Callout>
          )}
        </div>
      );
    case 'error': {
      const payload = event.payload as { message?: string };
      return (
        <div className="pl-10">
          <Callout tone="danger" role="alert" title="Something went wrong">
            {payload.message || event.fallbackText || 'Proba could not complete the last step. It will retry automatically.'}
          </Callout>
        </div>
      );
    }
    default:
      return event.fallbackText ? (
        <AssistantMessage at={event.at}>
          <RichText text={event.fallbackText} />
        </AssistantMessage>
      ) : null;
  }
}

export function ThreadView({ threadId, userName }: { threadId?: string; userName: string }) {
  const { state } = useWorkspace();
  const items = useMemo(() => selectThreadItems(state.events, state.localMessages, threadId), [state.events, state.localMessages, threadId]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [items.length]);

  if (items.length === 0) {
    return <p className="py-10 text-center text-body text-muted-foreground">No messages in this conversation yet.</p>;
  }

  return (
    <>
    <ol className="space-y-6" aria-label="Conversation">
      {items.map((item) => (
        <li key={item.key}>
          {item.kind === 'local' ? (
            <UserMessage text={item.message.text} at={item.message.sentAt} userName={userName} status={item.message.status} />
          ) : (
            <EventItem event={item.event} userName={userName} />
          )}
        </li>
      ))}
    </ol>
    <div ref={endRef} />
    </>
  );
}

export function Composer({ threadId, disabled }: { threadId?: string; disabled?: boolean }) {
  const { sendMessage } = useWorkspace();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const id = useId();
  const hintId = useId();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const ok = await sendMessage(value, threadId);
    setSending(false);
    if (ok) setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className="border-t bg-surface px-4 py-3 md:px-6">
      <label htmlFor={id} className="sr-only">
        Message Proba
      </label>
      <div className="flex items-end gap-2 rounded-lg border border-input/70 bg-surface px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <textarea
          id={id}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={hintId}
          placeholder="Message Proba about this goal…"
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-body text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || disabled} loading={sending}>
          {!sending && <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
          Send
        </Button>
      </div>
      <p id={hintId} className="mt-1.5 text-caption text-muted-foreground">
        Press Enter to send, Shift + Enter for a new line. Proba never launches campaigns or changes spend without your approval.
      </p>
    </form>
  );
}
