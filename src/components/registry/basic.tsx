import { useState, type ReactNode } from 'react';
import { Callout, type CalloutTone } from '../ui/feedback';
import { Badge, type Tone } from '../ui/badge';
import { cn } from '../../lib/utils/cn';
import { formatDateTime } from '../../lib/utils/format';
import type { ComponentRendererProps } from './types';

/** Minimal, safe Markdown: paragraphs, bullet lists and **bold**. No HTML is injected. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cn('space-y-2 text-body leading-relaxed text-foreground', className)}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

export function TextComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { text?: string; markdown?: boolean; emphasis?: 'normal' | 'bold' | 'italic' };
  const text = props.text || fallbackText;
  const emphasis = props.emphasis === 'bold' ? 'font-semibold' : props.emphasis === 'italic' ? 'italic' : '';
  if (props.markdown) return <RichText text={text} className={emphasis} />;
  return <p className={cn('whitespace-pre-line text-body leading-relaxed text-foreground', emphasis)}>{text}</p>;
}

export function AlertComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { severity?: string; title?: string; message?: string; dismissible?: boolean };
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const tone: CalloutTone =
    props.severity === 'error' ? 'danger' : props.severity === 'warning' ? 'warning' : props.severity === 'success' ? 'success' : 'info';
  return (
    <Callout
      tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      title={props.title}
      onDismiss={props.dismissible ? () => setDismissed(true) : undefined}
    >
      {props.message || fallbackText}
    </Callout>
  );
}

const statusMeta: Record<string, { label: string; tone: Tone; bar: string }> = {
  idle: { label: 'Idle', tone: 'neutral', bar: 'bg-muted-foreground' },
  thinking: { label: 'Planning', tone: 'info', bar: 'bg-info' },
  executing: { label: 'In progress', tone: 'primary', bar: 'bg-primary' },
  waiting: { label: 'Waiting for you', tone: 'warning', bar: 'bg-warning' },
  paused: { label: 'Paused', tone: 'warning', bar: 'bg-warning' },
  completed: { label: 'Completed', tone: 'success', bar: 'bg-success' },
  error: { label: 'Needs attention', tone: 'danger', bar: 'bg-destructive' },
};

export function StatusBannerComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { status?: string; message?: string; progress?: number };
  const meta = statusMeta[props.status ?? 'idle'] ?? statusMeta.idle;
  const progress = typeof props.progress === 'number' ? Math.max(0, Math.min(100, props.progress)) : undefined;
  return (
    <div role="status" className="rounded-lg border bg-card px-4 py-3 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <p className="truncate text-body font-medium text-foreground">{props.message || fallbackText}</p>
        </div>
        {progress !== undefined && <span className="text-body font-medium tabular-nums text-muted-foreground">{progress}%</span>}
      </div>
      {progress !== undefined && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={props.message || 'Progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className={cn('h-full rounded-full transition-all', meta.bar)} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

const timelineTone: Record<string, string> = {
  completed: 'bg-success',
  in_progress: 'bg-primary',
  pending: 'bg-muted-foreground/50',
  failed: 'bg-destructive',
};

const timelineLabel: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Scheduled',
  failed: 'Failed',
};

export function TimelineItemComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    timestamp?: string;
    title?: string;
    description?: string;
    status?: string;
    metadata?: Record<string, string | number>;
  };
  const status = props.status ?? 'completed';
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span className={cn('h-2.5 w-2.5 rounded-full ring-4 ring-background', timelineTone[status] ?? timelineTone.pending)} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-body font-medium text-foreground">{props.title || fallbackText}</p>
          <span className="sr-only">{timelineLabel[status]}</span>
          {props.timestamp && (
            <time dateTime={props.timestamp} className="text-caption text-muted-foreground">
              {formatDateTime(props.timestamp)}
            </time>
          )}
        </div>
        {props.description && <p className="mt-0.5 text-body text-muted-foreground">{props.description}</p>}
        {props.metadata && Object.keys(props.metadata).length > 0 && (
          <dl className="mt-2 flex flex-wrap gap-2">
            {Object.entries(props.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-caption">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="font-medium text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
