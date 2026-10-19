import type { ReactNode } from 'react';
import { CircleHelp, ClipboardCheck, ShieldAlert } from 'lucide-react';
import type { IncomingEvent } from '../../lib/transport';
import { formatRelativeTime } from '../../lib/utils/format';
import { askPayload } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { useResolvedAskIds } from '../../state/hooks';
import { ComponentRenderer } from '../registry';
import { Badge } from '../ui/badge';
import { Callout } from '../ui/feedback';

const typeMeta = {
  clarify: { label: 'Question for you', icon: CircleHelp },
  plan_approval: { label: 'Plan awaiting approval', icon: ClipboardCheck },
  action_approval: { label: 'Approval required', icon: ShieldAlert },
} as const;

export function AskCard({ event, context, showTime = true }: { event: IncomingEvent; context?: ReactNode; showTime?: boolean }) {
  const { state, respond } = useWorkspace();
  const resolved = useResolvedAskIds();
  const ask = askPayload(event);
  if (!ask) return null;

  const meta = typeMeta[ask.askType] ?? typeMeta.action_approval;
  const Icon = meta.icon;
  const decision = state.decisions[ask.askId];
  const isResolved = resolved.has(ask.askId) || decision?.state === 'submitted';
  const disabled = isResolved || decision?.state === 'submitting';

  const outcome =
    decision?.choice === 'reject'
      ? 'You declined this request.'
      : decision?.choice === 'edit'
        ? 'You asked for changes. Reply in this thread with what you would like revised.'
        : ask.askType === 'clarify'
          ? 'Answer sent. Proba is continuing with your choice.'
          : ask.askType === 'plan_approval'
            ? 'You approved this plan. Proba is proceeding.'
            : 'You approved this change. Proba is applying it.';

  return (
    <section aria-label={`${meta.label}: ${ask.title}`} className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {meta.label}
        </span>
        {!isResolved && <Badge tone="warning">Awaiting your decision</Badge>}
        {context}
        {showTime && (
          <time dateTime={event.at} className="ml-auto text-caption text-muted-foreground">
            {formatRelativeTime(event.at)}
          </time>
        )}
      </div>
      {ask.askType === 'clarify' && ask.description && <p className="text-body text-muted-foreground">{ask.description}</p>}
      {event.ui ? (
        <ComponentRenderer
          ui={event.ui as never}
          fallbackText={event.fallbackText ?? ask.title}
          disabled={disabled}
          onAction={(request) => respond(event, request)}
        />
      ) : (
        <ComponentRenderer
          ui={{ component: 'approval_card', version: '1.0.0', props: { title: ask.title, description: ask.description, risk: ask.risk } }}
          fallbackText={event.fallbackText ?? ask.title}
          disabled={disabled}
          onAction={(request) => respond(event, request)}
        />
      )}
      {isResolved && (
        <Callout tone={decision?.choice === 'reject' ? 'info' : 'success'} role="status">
          <span className="inline-flex items-center gap-1.5">
            {decision ? outcome : 'This request has been resolved.'}
          </span>
        </Callout>
      )}
      {decision?.state === 'submitting' && <p className="sr-only" role="status">Sending your decision…</p>}
    </section>
  );
}

