import { useMemo } from 'react';
import { ArrowLeft, ChevronRight, Megaphone } from 'lucide-react';
import { routeHref } from '../../lib/router';
import { formatCurrency, formatNumber, formatPercent, formatRelativeTime } from '../../lib/utils/format';
import { describeEvent, selectReports, type ActivityEntry, type GoalView } from '../../state/selectors';
import { useGoals } from '../../state/hooks';
import { useWorkspace } from '../../state/workspace';
import { ComponentRenderer } from '../registry';
import { GoalStatusBadge, MetricTileComponent } from '../registry/cards';
import { SpendBarComponent } from '../registry/spend-bar';
import { Card, CardBody, CardHeader } from '../ui/card';
import { EmptyState, Skeleton } from '../ui/feedback';
import { Page, PageHeader } from './common';

function kpis(goal: GoalView): Array<{ label: string; value: string }> {
  const m = goal.metrics;
  if (!m) return [];
  const out = [{ label: 'Spend', value: formatCurrency(m.spend, m.currency) }];
  if (m.impressions !== undefined) out.push({ label: 'Impressions', value: formatNumber(m.impressions) });
  if (m.clicks !== undefined) out.push({ label: 'Clicks', value: formatNumber(m.clicks) });
  if (m.clicks !== undefined && m.impressions) out.push({ label: 'Click-through rate', value: formatPercent((m.clicks / m.impressions) * 100, 2) });
  if (m.conversions !== undefined) out.push({ label: 'Conversions', value: formatNumber(m.conversions) });
  if (m.conversions) out.push({ label: 'Cost per conversion', value: formatCurrency(m.spend / m.conversions, m.currency, { decimals: 2 }) });
  return out;
}

function CampaignCard({ goal }: { goal: GoalView }) {
  const m = goal.metrics;
  return (
    <li>
      <a
        href={routeHref({ section: 'campaigns', id: goal.goalId })}
        className="group block h-full rounded-lg border bg-card p-5 shadow-card transition-shadow hover:shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-body font-semibold text-foreground">{goal.title}</p>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
        </div>
        <div className="mt-2">
          <GoalStatusBadge status={goal.status} />
        </div>
        {m && (
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-caption text-muted-foreground">Spend</dt>
              <dd className="text-body font-semibold tabular-nums">{formatCurrency(m.spend, m.currency, { compact: m.spend >= 10000 })}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Conversions</dt>
              <dd className="text-body font-semibold tabular-nums">{formatNumber(m.conversions ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Cap</dt>
              <dd className="text-body font-semibold tabular-nums">{m.budget ? formatCurrency(m.budget, m.currency) : '—'}</dd>
            </div>
          </dl>
        )}
        {m?.budget ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={m.spend / m.budget >= 0.8 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-primary'}
              style={{ width: `${Math.min(100, (m.spend / m.budget) * 100)}%` }}
            />
          </div>
        ) : null}
      </a>
    </li>
  );
}

export function CampaignsView({ selectedId }: { selectedId?: string }) {
  const { state } = useWorkspace();
  const goals = useGoals();
  const goal = selectedId ? goals.find((g) => g.goalId === selectedId) : undefined;
  const reports = useMemo(() => (goal ? selectReports(state.events, goal.threadId) : []), [state.events, goal]);
  const updates = useMemo(
    () =>
      goal
        ? state.events
            .filter((e) => e.threadId === goal.threadId && (e.type === 'alert' || e.type === 'status' || e.type === 'ask_resolved'))
            .map(describeEvent)
            .filter((e): e is ActivityEntry => e !== null)
            .reverse()
            .slice(0, 4)
        : [],
    [state.events, goal]
  );

  if (!state.hasLoaded) {
    return (
      <Page>
        <div aria-busy="true" aria-label="Loading campaigns" className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </Page>
    );
  }

  if (!goal) {
    const withData = goals.filter((g) => g.metrics && (g.metrics.spend > 0 || g.status === 'active'));
    return (
      <Page>
        <PageHeader title="Campaigns" description="Live and completed campaigns across your goals, with spend tracked against every cap." />
        <div className="mt-8">
          {withData.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Megaphone className="h-6 w-6" />}
                title={selectedId ? 'Campaign not found' : 'No campaigns yet'}
                description="Campaigns appear here once you approve a plan and Proba launches it. You can follow spend, results and tests in real time."
              />
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {withData.map((g) => (
                <CampaignCard key={g.goalId} goal={g} />
              ))}
            </ul>
          )}
        </div>
      </Page>
    );
  }

  const spendBars = reports.filter((r) => r.ui?.component === 'spend_bar');
  const charts = reports.filter((r) => r.ui?.component === 'metric_chart');
  const tables = reports.filter((r) => r.ui?.component === 'table');
  const tiles = reports.filter((r) => r.ui?.component === 'metric_tile');
  const metrics = kpis(goal);

  return (
    <Page>
      <a href={routeHref({ section: 'campaigns' })} className="mb-4 inline-flex items-center gap-1 text-body font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All campaigns
      </a>
      <PageHeader
        eyebrow={<GoalStatusBadge status={goal.status} />}
        title={goal.title}
        description="Performance across every channel, reported by Proba and checked against your spend cap."
        actions={
          <a
            href={routeHref({ section: 'goals', id: goal.goalId })}
            className="inline-flex h-9 items-center rounded-md border border-input/60 bg-surface px-4 text-body font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Open conversation
          </a>
        }
      />

      {metrics.length > 0 && (
        <section aria-label="Key metrics" className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {metrics.map((k) => (
            <MetricTileComponent key={k.label} ui={{ component: 'metric_tile', version: '1.0.0', props: { label: k.label, value: k.value } }} fallbackText={k.label} />
          ))}
        </section>
      )}

      {reports.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No performance data yet"
            description="Results will appear here as soon as this campaign goes live."
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {charts.map((e) => (
              <ComponentRenderer key={e.seq} ui={e.ui as never} fallbackText={e.fallbackText ?? ''} />
            ))}
          </div>
          <div className="space-y-6">
            {spendBars.length > 0
              ? spendBars.map((e) => <ComponentRenderer key={e.seq} ui={e.ui as never} fallbackText={e.fallbackText ?? ''} />)
              : goal.metrics?.budget && (
                  <SpendBarComponent
                    ui={{ component: 'spend_bar', version: '1.0.0', props: { spent: goal.metrics.spend, budget: goal.metrics.budget, currency: goal.metrics.currency } }}
                    fallbackText=""
                  />
                )}
            {tiles.map((e) => (
              <ComponentRenderer key={e.seq} ui={e.ui as never} fallbackText={e.fallbackText ?? ''} />
            ))}
            {updates.length > 0 && (
              <Card>
                <CardHeader title="Recent updates" titleAs="h2" />
                <CardBody className="p-0">
                  <ul className="divide-y">
                    {updates.map((u) => (
                      <li key={u.key} className="px-5 py-3">
                        <p className="text-body font-medium text-foreground">{u.title}</p>
                        {u.detail && <p className="mt-0.5 text-body text-muted-foreground">{u.detail}</p>}
                        <time dateTime={u.at} className="mt-1 block text-caption text-muted-foreground">
                          {formatRelativeTime(u.at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
          {tables.map((e) => (
            <div key={e.seq} className="xl:col-span-3">
              <ComponentRenderer ui={e.ui as never} fallbackText={e.fallbackText ?? ''} />
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
