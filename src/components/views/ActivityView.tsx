import { useMemo, useState } from 'react';
import { Activity, Bell, CircleCheck, CircleHelp, MessageSquare, RefreshCw, Target, type LucideIcon } from 'lucide-react';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatDateTime } from '../../lib/utils/format';
import type { ActivityCategory, ActivityEntry } from '../../state/selectors';
import { useActivity, useGoals } from '../../state/hooks';
import { useWorkspace } from '../../state/workspace';
import { Card } from '../ui/card';
import { EmptyState, Skeleton } from '../ui/feedback';
import { Page, PageHeader } from './common';

const FILTERS: Array<{ id: 'all' | ActivityCategory; label: string }> = [
  { id: 'all', label: 'All activity' },
  { id: 'decision', label: 'Decisions' },
  { id: 'question', label: 'Questions' },
  { id: 'update', label: 'Updates' },
  { id: 'alert', label: 'Alerts' },
  { id: 'message', label: 'Messages' },
];

const icons: Record<ActivityCategory, LucideIcon> = {
  decision: CircleCheck,
  question: CircleHelp,
  update: RefreshCw,
  alert: Bell,
  message: MessageSquare,
  goal: Target,
};

const toneClass: Record<ActivityEntry['tone'], string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-destructive-subtle text-destructive',
  info: 'bg-info-subtle text-info',
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function ActivityView() {
  const { state } = useWorkspace();
  const activity = useActivity();
  const goals = useGoals();
  const [filter, setFilter] = useState<'all' | ActivityCategory>('all');
  const goalByThread = useMemo(() => new Map(goals.map((g) => [g.threadId, g])), [goals]);

  const filtered = filter === 'all' ? activity : activity.filter((a) => a.category === filter);
  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    filtered.forEach((entry) => {
      const key = dayLabel(entry.at);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Activity" description="A complete, auditable record of every plan, decision, change and update in this workspace." />
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-body font-medium transition-colors',
              filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface text-foreground hover:bg-muted'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {!state.hasLoaded ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title={filter === 'all' ? 'No activity yet' : 'Nothing to show for this filter'}
              description={
                filter === 'all'
                  ? 'Everything Proba plans, changes or reports will be recorded here.'
                  : 'Try another filter to see more of the activity in this workspace.'
              }
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {groups.map(([day, entries], gi) => (
              <section key={day} aria-labelledby={`activity-day-${gi}`}>
                <h2 id={`activity-day-${gi}`} className="mb-3 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                  {day}
                </h2>
                <Card>
                  <ol className="divide-y">
                    {entries.map((entry) => {
                      const Icon = icons[entry.category];
                      const goal = goalByThread.get(entry.threadId);
                      return (
                        <li key={entry.key} className="flex gap-4 px-5 py-4">
                          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', toneClass[entry.tone])} aria-hidden="true">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <p className="text-body font-medium text-foreground">{entry.title}</p>
                              <time dateTime={entry.at} className="text-caption text-muted-foreground">
                                {formatDateTime(entry.at)}
                              </time>
                            </div>
                            {entry.detail && <p className="mt-0.5 line-clamp-2 text-body text-muted-foreground">{entry.detail.replace(/\*\*/g, '')}</p>}
                            {goal && (
                              <a
                                href={routeHref({ section: 'goals', id: goal.goalId })}
                                className="mt-1.5 inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
                              >
                                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                                {goal.title}
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
