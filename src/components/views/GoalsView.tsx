import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChartColumn, ChevronDown, MessageSquare, PanelRightClose, Plus, ShieldCheck, Target, X } from 'lucide-react';
import type { GoalStatus as HubGoalStatus } from '../../lib/actions/client';
import type { Session } from '../../lib/auth';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { SHORT_VIEWPORT_QUERY, useMediaQuery } from '../../lib/utils/useMediaQuery';
import { formatCurrency, formatNumber, formatRelativeTime } from '../../lib/utils/format';
import { askPayload, selectLatestStatus, type GoalView } from '../../state/selectors';
import { buildResearchAnswerPayload, researchAnswerCommand } from '../../lib/research';
import { useActionsClient } from '../../state/actions';
import { useGoals, useOpenAsks } from '../../state/hooks';
import { useUIMode } from '../../state/ui-mode';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';
import { StatusBannerComponent } from '../registry/basic';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { EmptyState, Skeleton } from '../ui/feedback';
import { AnalyticsCharts } from './AnalyticsCharts';
import { DecisionInbox } from './DecisionInbox';
import { Composer, ThreadView } from './Thread';
import { NewGoalDialog } from './NewGoalDialog';
import { GoalStatusPanel } from './GoalStatusPanel';
import { GeoVisibilityPanel } from './GeoVisibilityPanel';
import { LaunchPreviewCard } from './LaunchPreviewCard';
import { MagicPromptCanvas } from './MagicPromptCanvas';

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
    stats.push(['Impressions', formatNumber(m.impressions ?? 0, { compact: true })]);
    stats.push(['Clicks', formatNumber(m.clicks ?? 0)]);
    stats.push(['Conversions', formatNumber(m.conversions ?? 0)]);
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


function GoalHeader({
  goal,
  status,
  compact,
  hasLiveCampaigns,
  copilotOpen,
  openAskCount,
  onToggleCopilot,
}: {
  goal: GoalView;
  status: ReturnType<typeof selectLatestStatus>;
  compact: boolean;
  hasLiveCampaigns: boolean;
  copilotOpen: boolean;
  openAskCount: number;
  onToggleCopilot: () => void;
}) {
  const [expanded, setExpanded] = useState(!compact);
  useEffect(() => {
    setExpanded(!compact);
  }, [compact]);

  const detailsOpen = !compact || expanded;
  const canViewPerformance = Boolean(goal.metrics && (goal.metrics.spend > 0 || goal.status === 'active'));

  return (
    <div data-testid="goal-header" className={cn('border-b bg-surface px-4 md:px-6', detailsOpen ? 'py-5' : 'py-2.5')}>
      <a href={routeHref({ section: 'goals' })} className="mb-2 inline-flex items-center gap-1 text-body font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All goals
      </a>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn('flex flex-wrap items-center gap-2', detailsOpen ? 'mb-1.5' : 'mb-0.5')}>
            <GoalStatusBadge status={goal.status} />
            {hasLiveCampaigns && (
              <Badge tone="primary" className="gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Guarded Auto
              </Badge>
            )}
          </div>
          <h2 className={cn('text-foreground', detailsOpen ? 'text-heading' : 'truncate text-title')}>{goal.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compact && (
            <Button type="button" size="sm" variant="outline" aria-expanded={detailsOpen} onClick={() => setExpanded((open) => !open)}>
              {detailsOpen ? 'Hide details' : 'Show details'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={copilotOpen ? 'secondary' : 'outline'}
            aria-expanded={copilotOpen}
            onClick={onToggleCopilot}
          >
            {copilotOpen ? (
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            )}
            {copilotOpen ? 'Hide Co-pilot' : 'Co-pilot / Override'}
            {!copilotOpen && openAskCount > 0 && (
              <Badge tone="warning" className="ml-1">
                {openAskCount}
              </Badge>
            )}
          </Button>
          {canViewPerformance && (
            <a
              href={routeHref({ section: 'campaigns', id: goal.goalId })}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input/60 bg-surface px-4 text-body font-medium text-foreground shadow-sm hover:bg-muted"
            >
              <ChartColumn className="h-4 w-4" aria-hidden="true" />
              View performance
            </a>
          )}
        </div>
      </div>
      {detailsOpen && <GoalStats goal={goal} />}
      {detailsOpen && status && (
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
  );
}

export function GoalsView({ selectedId, session }: { selectedId?: string; session: Session }) {
  const workspace = useWorkspace();
  const { state, respond } = workspace;
  const { mode, setMode, userRole, canSwitchMode } = useUIMode();
  const actionsClient = useActionsClient();
  const goals = useGoals();
  const openAsks = useOpenAsks();
  const [creating, setCreating] = useState(false);
  const [goalsDrawerOpen, setGoalsDrawerOpen] = useState(false);
  const [goalStatus, setGoalStatus] = useState<HubGoalStatus | null>(null);
  const [copilotOverride, setCopilotOverride] = useState<boolean | null>(null);
  const [hasConnectedPlatform, setHasConnectedPlatform] = useState(true);
  const [launchingAuto, setLaunchingAuto] = useState(false);
  const autoApprovedRef = useRef<Set<string>>(new Set());
  const launchedGoalIdsRef = useRef<Set<string>>(new Set());
  const shortViewport = useMediaQuery(SHORT_VIEWPORT_QUERY);
  const selected = selectedId ? goals.find((g) => g.goalId === selectedId) : undefined;
  const pendingByThread = useMemo(() => {
    const counts = new Map<string, number>();
    openAsks.forEach((a) => a.threadId && counts.set(a.threadId, (counts.get(a.threadId) ?? 0) + 1));
    return counts;
  }, [openAsks]);
  const status = selected ? selectLatestStatus(state.events, selected.threadId) : null;
  const active = goals.filter((g) => g.status === 'active').length;

  useEffect(() => {
    setCopilotOverride(null);
    setGoalsDrawerOpen(false);
  }, [selected?.goalId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGoalsDrawerOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setGoalsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!actionsClient || !selected?.goalId) {
      setGoalStatus(null);
      return;
    }
    const controller = new AbortController();
    actionsClient
      .getGoalStatus(selected.goalId, controller.signal)
      .then((s) => {
        if (!controller.signal.aborted) setGoalStatus(s);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGoalStatus(null);
      });
    return () => controller.abort();
  }, [actionsClient, selected?.goalId, state.events.length]);

  const hasLiveCampaigns = (goalStatus?.now.campaigns.length ?? 0) > 0;
  const openAskCount = selected?.threadId ? (pendingByThread.get(selected.threadId) ?? 0) : 0;
  const threadAsks = useMemo(
    () => (selected?.threadId ? openAsks.filter((a) => a.threadId === selected.threadId) : []),
    [openAsks, selected?.threadId]
  );

  // Check connected ad platforms for Auto Mode inline connect prompt
  useEffect(() => {
    if (!actionsClient || typeof actionsClient.listConnections !== 'function') return;
    const controller = new AbortController();
    actionsClient
      .listConnections(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const connected = res.connections.some((p) => p.status === 'connected');
        setHasConnectedPlatform(connected);
      })
      .catch(() => {
        // leave default true on error
      });
    return () => controller.abort();
  }, [actionsClient]);

  // In 1-Click Auto Mode, silently advance intermediate asks (URL attach & research review)
  // so the user only sees the single unified LaunchPreviewCard.
  useEffect(() => {
    if (mode !== 'auto' || hasLiveCampaigns || !selected) return;
    for (const ev of threadAsks) {
      const ask = askPayload(ev);
      if (!ask || autoApprovedRef.current.has(ask.askId)) continue;
      const uiProps = (ev.ui?.props ?? {}) as Record<string, unknown>;
      const toolName = typeof uiProps.toolName === 'string' ? uiProps.toolName : '';
      if (ask.askType === 'research_review') {
        const built = buildResearchAnswerPayload(ask, 'approve');
        if (built.ok) {
          autoApprovedRef.current.add(ask.askId);
          void respond(ev, { id: 'approve', command: researchAnswerCommand(built.payload) });
        }
        continue;
      }
      const isAttachPage = toolName === 'page.attach_user_page' || /attach_user_page/i.test(ask.title);
      const isCreateAfterLaunch =
        launchedGoalIdsRef.current.has(selected.goalId) &&
        (toolName === 'ads.create_campaign' || ask.askType === 'action_approval');
      const isIntermediate = ask.askType === 'plan_approval' || isAttachPage || isCreateAfterLaunch;
      if (isIntermediate) {
        autoApprovedRef.current.add(ask.askId);
        void respond(ev, { id: 'approve' });
      }
    }
  }, [mode, hasLiveCampaigns, selected, threadAsks, respond]);

  const launchEvent = useMemo(
    () =>
      threadAsks.find((ev) => {
        const a = askPayload(ev);
        if (!a) return false;
        const uiProps = (ev.ui?.props ?? {}) as Record<string, unknown>;
        const toolName = typeof uiProps.toolName === 'string' ? uiProps.toolName : '';
        const isAttachPage = toolName === 'page.attach_user_page' || /attach_user_page/i.test(a.title);
        return (
          String(ev.ui?.component ?? '').includes('creative_draft') ||
          toolName === 'creative.draft_post' ||
          toolName === 'ads.create_campaign' ||
          (a.askType === 'action_approval' && !isAttachPage)
        );
      }),
    [threadAsks]
  );
  const launchAsk = launchEvent ? askPayload(launchEvent) ?? undefined : undefined;

  // AI-native default: in Auto Mode keep Co-pilot collapsed so LaunchPreviewCard / Command Center stays clean;
  // in Controlled Mode open Co-pilot when pre-launch or when asks are pending.
  const copilotOpen = copilotOverride ?? (mode === 'controlled' ? (!hasLiveCampaigns || openAskCount > 0) : false);
  const campaignIds = useMemo(
    () => (goalStatus ? goalStatus.now.campaigns.map((c) => c.probaCampaignId) : undefined),
    [goalStatus]
  );
  const platforms = useMemo(
    () => (goalStatus ? goalStatus.now.campaigns.map((c) => c.platform) : undefined),
    [goalStatus]
  );

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
    if (mode === 'auto') {
      return (
        <div className="h-full overflow-y-auto px-4 py-6 md:px-6">
          <MagicPromptCanvas
            hasConnectedPlatform={hasConnectedPlatform}
            userRole={userRole}
            goals={goals}
            onConnectPlatform={
              actionsClient
                ? (provider) => {
                    void actionsClient.startConnection(provider).then((r) => {
                      window.location.assign(r.authorizeUrl);
                    });
                  }
                : undefined
            }
          />
        </div>
      );
    }
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

  if (!selectedId) {
    if (mode === 'auto') {
      return (
        <div className="h-full overflow-y-auto px-4 py-6 md:px-6">
          <MagicPromptCanvas
            hasConnectedPlatform={hasConnectedPlatform}
            userRole={userRole}
            goals={goals}
            onConnectPlatform={
              actionsClient
                ? (provider) => {
                    void actionsClient.startConnection(provider).then((r) => {
                      window.location.assign(r.authorizeUrl);
                    });
                  }
                : undefined
            }
          />
        </div>
      );
    }
    return (
      <div className="h-full overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 id="goals-list-heading" className="text-heading text-foreground">
                Goals
              </h1>
              <p className="text-body text-muted-foreground">
                {active} active · {goals.length} total · Pick a goal to open its Command Center or press ⌘K anytime.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New goal
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <li key={goal.goalId} className="rounded-xl border bg-surface shadow-card">
                <GoalListItem goal={goal} selected={false} pending={goal.threadId ? pendingByThread.get(goal.threadId) ?? 0 : 0} />
              </li>
            ))}
          </ul>
        </div>
        <NewGoalDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Compact Top Goal Switcher Bar — frees 320px for Analytics + Co-pilot */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface-sunken/40 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setGoalsDrawerOpen(true)}
            aria-expanded={goalsDrawerOpen}
            aria-controls="goals-switcher-drawer"
          >
            <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="max-w-[220px] truncate">{selected ? selected.title : 'Select goal'}</span>
            <Badge tone="neutral" className="ml-0.5">{active} active / {goals.length}</Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </Button>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">⌘K</span>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New goal
        </Button>
      </div>

      {goalsDrawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={() => setGoalsDrawerOpen(false)}
          />
          <section
            id="goals-switcher-drawer"
            aria-labelledby="goals-list-heading"
            className="relative z-50 flex h-full w-80 max-w-[85vw] flex-col border-r bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
              <div>
                <h1 id="goals-list-heading" className="text-title text-foreground">
                  Goals
                </h1>
                <p className="text-caption text-muted-foreground">
                  {active} active · {goals.length} total
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => { setGoalsDrawerOpen(false); setCreating(true); }}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setGoalsDrawerOpen(false)} aria-label="Close goals drawer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {goals.map((goal) => (
                <li key={goal.goalId} onClick={() => setGoalsDrawerOpen(false)}>
                  <GoalListItem goal={goal} selected={goal.goalId === selected?.goalId} pending={goal.threadId ? pendingByThread.get(goal.threadId) ?? 0 : 0} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section aria-label={selected ? `Goal: ${selected.title}` : 'Goal'} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            {mode === 'controlled' && (
              <GoalHeader
                goal={selected}
                status={status}
                compact={shortViewport}
                hasLiveCampaigns={hasLiveCampaigns}
                copilotOpen={copilotOpen}
                openAskCount={openAskCount}
                onToggleCopilot={() => setCopilotOverride(!copilotOpen)}
              />
            )}
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-6">
                <div className={cn('mx-auto w-full min-w-0 space-y-6', mode === 'auto' ? 'max-w-2xl' : 'max-w-4xl')}>
                  {mode === 'auto' && !hasLiveCampaigns && (
                    <LaunchPreviewCard
                      goalTitle={selected.title}
                      event={launchEvent}
                      ask={launchAsk}
                      hasConnectedPlatform={hasConnectedPlatform}
                      canSwitchMode={canSwitchMode}
                      submitting={launchingAuto}
                      onConnectPlatform={
                        actionsClient
                          ? (provider) => {
                              void actionsClient.startConnection(provider).then((r) => {
                                window.location.assign(r.authorizeUrl);
                              });
                            }
                          : undefined
                      }
                      onSwitchToControlled={() => {
                        setMode('controlled');
                        setCopilotOverride(true);
                      }}
                      onLaunch={async (edited) => {
                        if (!launchEvent) return;
                        launchedGoalIdsRef.current.add(selected.goalId);
                        setLaunchingAuto(true);
                        try {
                          await respond(launchEvent, {
                            id: 'approve',
                            ...(edited ? { values: edited } : {}),
                          });
                        } finally {
                          setLaunchingAuto(false);
                        }
                      }}
                    />
                  )}
                  {mode === 'auto' && hasLiveCampaigns && goalStatus && (
                    <div className="rounded-2xl border border-white/10 bg-[#12121A] p-6 text-slate-100 shadow-2xl space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <Badge tone={goalStatus.now.state === 'running' ? 'success' : 'warning'} dot>
                            {goalStatus.now.state === 'running' ? 'Live & Optimizing' : 'Active'}
                          </Badge>
                          <h2 className="mt-2 text-xl font-bold text-white">{selected.title}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={routeHref({ section: 'goals' })}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-caption font-medium text-slate-200 hover:bg-white/10"
                          >
                            + New Campaign
                          </a>
                          {actionsClient && typeof actionsClient.pauseGoal === 'function' && (
                            <button
                              type="button"
                              onClick={() => void actionsClient.pauseGoal!(selected.goalId)}
                              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-caption font-medium text-slate-200 hover:bg-white/10"
                            >
                              ⏸ Pause
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/10 bg-[#09090D] p-3.5">
                          <div className="text-caption text-slate-400">Spent</div>
                          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                            {goalStatus.spend.spent !== null
                              ? formatCurrency(goalStatus.spend.spent, goalStatus.spend.currency ?? 'USD')
                              : '$0.00'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#09090D] p-3.5">
                          <div className="text-caption text-slate-400">Visitors / Metric</div>
                          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                            {goalStatus.progress.actual !== null ? formatNumber(goalStatus.progress.actual) : '0'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#09090D] p-3.5">
                          <div className="text-caption text-slate-400">Daily Cap</div>
                          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                            {goalStatus.spend.dailyCap !== null
                              ? formatCurrency(goalStatus.spend.dailyCap, goalStatus.spend.currency ?? 'USD')
                              : 'Auto'}
                          </div>
                        </div>
                      </div>
                      {goalStatus.decisions.length > 0 && (
                        <div>
                          <div className="text-caption font-semibold text-slate-300">Recent agent updates</div>
                          <ul className="mt-2 space-y-1.5 text-caption">
                            {goalStatus.decisions.slice(0, 3).map((d, i) => (
                              <li key={i} className="rounded-lg border border-white/10 bg-[#09090D] px-3 py-2 text-slate-200">
                                {d.summary}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {canSwitchMode && (
                        <div className="border-t border-white/10 pt-3 text-right">
                          <button
                            type="button"
                            onClick={() => setMode('controlled')}
                            className="text-caption font-medium text-slate-400 hover:text-white"
                          >
                            Want charts, creative studio &amp; GEO? Switch to Pro View →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {(mode === 'controlled' || (mode === 'auto' && hasLiveCampaigns && openAskCount > 0)) && (
                    <DecisionInbox
                      goalId={selected.goalId}
                      threadId={selected.threadId}
                      goalStatus={goalStatus}
                      onOpenCopilot={() => setCopilotOverride(true)}
                    />
                  )}
                  {mode === 'controlled' && (
                    <>
                      <GoalStatusPanel key={selected.goalId} goalId={selected.goalId} refreshKey={state.events.length} />
                      {hasLiveCampaigns && (
                        <AnalyticsCharts campaignIds={campaignIds} platforms={platforms} />
                      )}
                      <GeoVisibilityPanel
                        workspaceId="seedbed"
                        goalId={selected.goalId}
                        brandName={selected.title}
                        landingPageUrl=""
                        onSendProposalToCopilot={(promptText) => {
                          setCopilotOverride(true);
                          const sendFn = (workspace as unknown as { send?: (threadId: string, text: string) => void }).send;
                          if (typeof sendFn === 'function' && selected.threadId) {
                            sendFn(selected.threadId, promptText);
                          } else {
                            navigator.clipboard?.writeText(promptText);
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
              {copilotOpen && (
                <aside
                  aria-label="Proba Co-pilot"
                  className="flex min-h-0 w-full flex-col border-l bg-surface-sunken/30 lg:w-[400px] xl:w-[440px] shrink-0"
                >
                  <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                      Proba Co-pilot &amp; Overrides
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopilotOverride(false)}
                      className="text-caption text-muted-foreground hover:text-foreground"
                    >
                      Collapse
                    </button>
                  </div>
                  <div data-testid="goal-thread-scroller" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
                    <ThreadView threadId={selected.threadId} userName={session.user.name} />
                  </div>
                  <Composer threadId={selected.threadId} disabled={state.connection === 'closed'} />
                </aside>
              )}
            </div>
          </>
        ) : (
          <EmptyState icon={<Target className="h-6 w-6" />} title="Goal not found" description="This goal may have been removed or belongs to another workspace." />
        )}
      </section>
      <NewGoalDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
