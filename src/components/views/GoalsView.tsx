import { useMemo, useState } from 'react';
import { ArrowLeft, ChartColumn, Plus, Target } from 'lucide-react';
import type { Session } from '../../lib/auth';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatNumber, formatRelativeTime } from '../../lib/utils/format';
import { selectLatestStatus, type GoalView } from '../../state/selectors';
import { useGoals, useOpenAsks } from '../../state/hooks';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';
import { StatusBannerComponent } from '../registry/basic';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { EmptyState, Skeleton } from '../ui/feedback';
import { Composer, ThreadView } from './Thread';
import { NewGoalDialog } from './NewGoalDialog';

function GoalListItem({ goal, selected, pending }: { goal: GoalView; selected: boolean; pending: number }) {
  return (
    <a
      href={routeHref({ section: 'goals', id: goal.goalId })}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block rounded-lg border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary/50 bg-primary-subtle/70 shadow-card' : 'border-transparent hover:border-border hover:bg-surface'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-body font-semibold text-foreground">{goal.title}</p>
        {pending > 0 && (
          <Badge tone="warning" className="shrink-0">
            {pending} pending
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <GoalStatusBadge status={goal.status} />
        <span className="text-caption text-muted-foreground">Updated {formatRelativeTime(goal.updatedAt)}</span>
      </div>
      {goal.progressPercent !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, goal.progressPercent)}%` }} />
          </div>
          <span className="text-caption font-medium tabular-nums text-muted-foreground">
            <span className="sr-only">Progress </span>
            {goal.progressPercent}%
          </span>
        </div>
      )}
    </a>
  );
}

function GoalStats({ goal }: { goal: GoalView }) {
  const m = goal.metrics;
  const stats: Array<[string, string]> = [];
  if (m) {
    stats.push(['Spend', m.budget ? `${formatCurrency(m.spend, m.currency)} of ${formatCurrency(m.budget, m.currency)}` : formatCurrency(m.spend, m.currency)]);
    if (m.impressions !== undefined) stats.push(['Impressions', formatNumber(m.impressions, { compact: true })]);
    if (m.clicks !== undefined) stats.push(['Clicks', formatNumber(m.clicks)]);
    if (m.conversions !== undefined) stats.push(['Conversions', formatNumber(m.conversions)]);
  }
  if (goal.progressPercent !== undefined) stats.unshift(['Progress', `${goal.progressPercent}%`]);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-caption text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-body font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GoalsView({ selectedId, session }: { selectedId?: string; session: Session }) {
  const { state } = useWorkspace();
  const goals = useGoals();
  const openAsks = useOpenAsks();
  const [creating, setCreating] = useState(false);
  const selected = goals.find((g) => g.goalId === selectedId) ?? (selectedId ? undefined : goals[0]);
  const pendingByThread = useMemo(() => {
    const counts = new Map<string, number>();
    openAsks.forEach((a) => a.threadId && counts.set(a.threadId, (counts.get(a.threadId) ?? 0) + 1));
    return counts;
  }, [openAsks]);
  const status = selected ? selectLatestStatus(state.events, selected.threadId) : null;
  const active = goals.filter((g) => g.status === 'active').length;

  if (!state.hasLoaded) {
    return (
      <div className="flex h-full" aria-busy="true" aria-label="Loading goals">
        <div className="hidden w-80 shrink-0 space-y-3 border-r p-4 lg:block">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-8 h-40 w-full" />
          <Skeleton className="h-24 w-3/4" />
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    const steps = [
      { title: 'Describe your goal', body: 'A product to launch, a market to test or an offer to validate.' },
      { title: 'Approve the plan', body: 'Proba proposes channels, creative and budget. Nothing runs until you approve.' },
      { title: 'Track the results', body: 'Follow spend against your cap, conversions and test winners live.' },
    ];
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-3xl rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Create your first goal"
            description="Tell Proba what you want to launch or test. It will research, propose a plan and wait for your approval before spending anything."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New goal
              </Button>
            }
          />
          <ol className="grid gap-px overflow-hidden rounded-b-xl border-t bg-border sm:grid-cols-3" aria-label="How Proba works">
            {steps.map((step, i) => (
              <li key={step.title} className="bg-surface-sunken/60 px-5 py-4">
                <p className="text-caption font-semibold uppercase tracking-wide text-primary">Step {i + 1}</p>
                <p className="mt-1 text-body font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-body text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <NewGoalDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <section
        aria-labelledby="goals-list-heading"
        className={cn('w-full shrink-0 flex-col border-r bg-surface-sunken/50 lg:flex lg:w-80', selectedId ? 'hidden' : 'flex')}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
          <div>
            <h1 id="goals-list-heading" className="text-title text-foreground">
              Goals
            </h1>
            <p className="text-caption text-muted-foreground">
              {active} active · {goals.length} total
            </p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New goal
          </Button>
        </div>
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {goals.map((goal) => (
            <li key={goal.goalId}>
              <GoalListItem goal={goal} selected={goal.goalId === selected?.goalId} pending={goal.threadId ? pendingByThread.get(goal.threadId) ?? 0 : 0} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={selected ? `Goal: ${selected.title}` : 'Goal'} className={cn('min-w-0 flex-1 flex-col', selectedId ? 'flex' : 'hidden lg:flex')}>
        {selected ? (
          <>
            <div className="border-b bg-surface px-4 py-5 md:px-6">
              <a href={routeHref({ section: 'goals' })} className="mb-3 inline-flex items-center gap-1 text-body font-medium text-primary hover:underline lg:hidden">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All goals
              </a>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <GoalStatusBadge status={selected.status} />
                  </div>
                  <h2 className="text-heading text-foreground">{selected.title}</h2>
                </div>
                {selected.metrics && selected.metrics.spend > 0 && (
                  <a
                    href={routeHref({ section: 'campaigns', id: selected.goalId })}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-input/60 bg-surface px-4 text-body font-medium text-foreground shadow-sm hover:bg-muted"
                  >
                    <ChartColumn className="h-4 w-4" aria-hidden="true" />
                    View performance
                  </a>
                )}
              </div>
              <GoalStats goal={selected} />
              {status && (
                <div className="mt-4">
                  <StatusBannerComponent
                    ui={{
                      component: 'status_banner',
                      version: '1.0.0',
                      props: {
                        status: status.state,
                        message: status.message,
                        progress: status.progress && status.progress.total > 0 ? Math.round((status.progress.current / status.progress.total) * 100) : undefined,
                      },
                    }}
                    fallbackText={status.message ?? ''}
                  />
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
              <div className="mx-auto max-w-3xl">
                <ThreadView threadId={selected.threadId} userName={session.user.name} />
              </div>
            </div>
            <Composer threadId={selected.threadId} disabled={state.connection === 'closed'} />
          </>
        ) : (
          <EmptyState icon={<Target className="h-6 w-6" />} title="Goal not found" description="This goal may have been removed or belongs to another workspace." />
        )}
      </section>
      <NewGoalDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
