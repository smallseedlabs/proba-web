import { useEffect, useState } from 'react';
import type { CreativeVariantRecord, GoalStatus } from '../../lib/actions/client';
import { formatDateTime, formatCurrency, formatNumber, formatRelativeTime } from '../../lib/utils/format';
import { useActionsClient } from '../../state/actions';
import { Badge } from '../ui/badge';
import { SpendBarComponent } from '../registry/spend-bar';
import { EnhanceCreativeModal } from './EnhanceCreativeModal';
import { PlatformDeliveryMatrix } from './PlatformDeliveryMatrix';

const METRIC_LABELS: Record<string, string> = {
  clicks: 'Clicks',
  ctr: 'CTR',
  cpc: 'CPC',
  landing_page_views: 'Landing page views',
  signups: 'Sign-ups',
  conversions: 'Conversions',
};

const NOW_LABELS: Record<GoalStatus['now']['state'], string> = {
  no_campaign: 'No campaign live yet',
  awaiting_approval: 'Running · a change is waiting for your approval',
  running: 'Running',
};

/** Unknown stays unknown: a null number is shown as "Unknown", never as zero. */
function money(value: number | null, currency: string | null): string {
  return value === null ? 'Unknown' : formatCurrency(value, currency ?? 'USD');
}

function metricValue(metric: string | null, value: number | null, currency: string | null): string {
  if (value === null) return 'Unknown';
  if (metric === 'ctr') return `${(value * 100).toFixed(2)}%`;
  if (metric === 'cpc') return formatCurrency(value, currency ?? 'USD');
  return formatNumber(value);
}

/**
 * Goal page summary from the Hub: Now / Next / Spend vs cap / Progress / Recent decisions. Read-only
 * visibility; overrides stay on the cards and in Campaigns. Hidden when the Hub has no reviewer data API.
 */
export function GoalStatusPanel({ goalId, refreshKey }: { goalId: string; refreshKey?: unknown }) {
  const client = useActionsClient();
  const [status, setStatus] = useState<GoalStatus | null>(null);
  const [variants, setVariants] = useState<CreativeVariantRecord[]>([]);
  const [enhancingVariant, setEnhancingVariant] = useState<CreativeVariantRecord | null>(null);
  const [pausingTarget, setPausingTarget] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingKillSwitch, setConfirmingKillSwitch] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [goalCosts, setGoalCosts] = useState<{ totalUsd: number; count: number } | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    setConfirmingCancel(false);
    setConfirmingKillSwitch(false);
    setPausingTarget(null);
    setPauseError(null);
    if (!client) return;
    const controller = new AbortController();
    setStatus(null);
    setGoalCosts(null);
    client
      .getGoalStatus(goalId, controller.signal)
      .then(setStatus)
      .catch(() => setStatus(null));
    if (typeof client.listGoalCreatives === 'function') {
      client
        .listGoalCreatives(goalId, controller.signal)
        .then(setVariants)
        .catch(() => setVariants([]));
    }
    const getCosts = (client as { getGoalCosts?: (id: string, signal?: AbortSignal) => Promise<{ totalUsd: number; count: number }> }).getGoalCosts;
    if (typeof getCosts === 'function') {
      getCosts.call(client, goalId, controller.signal)
        .then(setGoalCosts)
        .catch(() => setGoalCosts(null));
    }
    return () => controller.abort();
  }, [client, goalId, refreshKey, localRefresh]);

  if (!status) return null;
  const { now, next, spend, progress, decisions, plan, goal } = status;
  const isCancelled = goal.status === 'cancelled' || goal.status === 'inactive';
  const metric = progress.metric;
  const reasons = plan && typeof plan.reasons === 'object' && plan.reasons !== null ? (plan.reasons as Record<string, unknown>) : {};
  const hasPausableCampaign = !isCancelled && now.campaigns.some((c) => c.providerCampaignId && c.delivery?.state !== 'paused');

  const handlePauseGoal = async () => {
    if (!client || typeof client.pauseGoal !== 'function') return;
    setPausingTarget('goal');
    setPauseError(null);
    try {
      await client.pauseGoal(goalId);
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to pause goal campaigns.');
    } finally {
      setPausingTarget(null);
    }
  };

  const handlePauseCampaign = async (probaCampaignId: string) => {
    if (!client || typeof client.pauseCampaign !== 'function') return;
    setPausingTarget(probaCampaignId);
    setPauseError(null);
    try {
      await client.pauseCampaign(probaCampaignId);
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to pause platform campaign.');
    } finally {
      setPausingTarget(null);
    }
  };

  const handleCancelGoal = async () => {
    if (!client || typeof client.cancelGoal !== 'function') return;
    setPausingTarget('cancel_goal');
    setPauseError(null);
    try {
      await client.cancelGoal(goalId);
      setConfirmingCancel(false);
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to cancel goal.');
    } finally {
      setPausingTarget(null);
    }
  };

  const handleCancelCampaign = async (probaCampaignId: string) => {
    if (!client || typeof client.cancelCampaign !== 'function') return;
    setPausingTarget(probaCampaignId);
    setPauseError(null);
    try {
      await client.cancelCampaign(probaCampaignId);
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to cancel platform campaign.');
    } finally {
      setPausingTarget(null);
    }
  };

  const handleKillSwitch = async () => {
    const killFn = (
      client as { killSwitch?: () => Promise<{ ok?: boolean; paused?: number; failed?: number }> } | null
    )?.killSwitch;
    if (!killFn) return;
    setPausingTarget('kill_switch');
    setPauseError(null);
    try {
      const res = await killFn();
      setConfirmingKillSwitch(false);
      if (res && typeof res.failed === 'number' && res.failed > 0) {
        setPauseError(`Stopped ${res.paused ?? 0} campaign(s), but ${res.failed} failed to pause. Check platform connections.`);
      }
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to trigger emergency kill-switch.');
    } finally {
      setPausingTarget(null);
    }
  };

  const watchdogPaused =
    Boolean((status as { watchdogPaused?: boolean }).watchdogPaused) ||
    Boolean(next?.reason?.toLowerCase().includes('watchdog')) ||
    now.campaigns.some((c) => Boolean((c as { watchdogPaused?: boolean }).watchdogPaused));

  const rawPaceRatio = (spend as unknown as { paceRatio?: unknown }).paceRatio;
  const paceRatio = typeof rawPaceRatio === 'number' ? rawPaceRatio : null;

  return (
    <section aria-label="Goal status" className="mb-6 rounded-xl border bg-card p-4 shadow-card">
      {watchdogPaused ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-body text-danger"
        >
          <span className="font-semibold">Safety stop (Spend Watchdog):</span> Campaign spend pace exceeded safe limits and was automatically paused.
        </div>
      ) : null}
      {isCancelled ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-body text-foreground">
          <span className="font-semibold">{goal.status === 'inactive' ? 'Goal inactive.' : 'Goal cancelled.'}</span>{' '}
          {goal.status === 'inactive'
            ? 'This goal had no attached campaigns and has been marked inactive. Historical activity remains below.'
            : 'All platform campaigns, pending proposals, and scheduled reviews are halted. Historical activity and metrics remain below.'}
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-caption text-muted-foreground">Now</dt>
          <dd className="mt-0.5 text-body font-semibold text-foreground">{NOW_LABELS[now.state]}</dd>
          {now.campaigns.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {now.campaigns.map((c) => (
                <Badge key={c.probaCampaignId}>{c.platform.toUpperCase()}</Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Next check</dt>
          <dd className="mt-0.5 text-body text-foreground">
            {next ? (
              <>
                <span className="font-semibold" title={formatDateTime(next.checkAt)}>
                  {formatDateTime(next.checkAt)}
                </span>
                {next.reason ? <span className="block text-caption text-muted-foreground">{next.reason}</span> : null}
              </>
            ) : (
              'Not scheduled'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Spend vs cap</dt>
          <dd className="mt-0.5 text-body font-semibold tabular-nums text-foreground">
            {money(spend.spent, spend.currency)}
            {spend.totalCap !== null ? ` of ${money(spend.totalCap, spend.currency)}` : ''}
            {spend.dailyCap !== null ? (
              <span className="block text-caption font-normal text-muted-foreground">Daily budget {money(spend.dailyCap, spend.currency)}</span>
            ) : null}
            {goalCosts && goalCosts.count > 0 ? (
              <span className="block text-caption font-normal text-muted-foreground">
                AI &amp; media costs ${goalCosts.totalUsd.toFixed(2)} ({goalCosts.count})
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Progress{metric ? ` · ${METRIC_LABELS[metric] ?? metric}` : ''}</dt>
          <dd className="mt-0.5 text-body font-semibold tabular-nums text-foreground">
            {metric ? (
              <>
                {metricValue(metric, progress.actual, spend.currency)}
                {progress.target !== null ? ` of ${metricValue(metric, progress.target, spend.currency)}` : ''}
              </>
            ) : (
              'No success metric yet'
            )}
            {typeof reasons.successMetric === 'string' ? (
              <span className="block text-caption font-normal text-muted-foreground">Chosen because {reasons.successMetric}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {spend.totalCap !== null && spend.spent !== null ? (
        <div className="mt-4">
          <SpendBarComponent
            fallbackText=""
            ui={{
              component: 'spend_bar',
              version: '1',
              props: {
                title: 'Goal spend vs. cap',
                spent: spend.spent,
                budget: spend.totalCap,
                currency: spend.currency ?? 'USD',
                paceRatio,
              },
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Platforms &amp; delivery status</h2>
          <div className="flex flex-wrap items-center gap-2">
            {hasPausableCampaign && client && typeof client.pauseGoal === 'function' ? (
              <button
                type="button"
                disabled={pausingTarget !== null}
                onClick={handlePauseGoal}
                className="rounded border border-input/70 bg-surface px-2.5 py-1 text-caption font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {pausingTarget === 'goal' ? 'Pausing all…' : 'Pause all platforms'}
              </button>
            ) : null}
            {!isCancelled && client && typeof client.cancelGoal === 'function' ? (
              confirmingCancel ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pausingTarget !== null}
                    onClick={handleCancelGoal}
                    className="rounded border border-danger/50 bg-danger/10 px-2.5 py-1 text-caption font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                  >
                    {pausingTarget === 'cancel_goal' ? 'Cancelling…' : 'Confirm cancel goal'}
                  </button>
                  <button
                    type="button"
                    disabled={pausingTarget !== null}
                    onClick={() => setConfirmingCancel(false)}
                    className="rounded border border-input/70 bg-surface px-2 py-1 text-caption text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Keep running
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pausingTarget !== null}
                  onClick={() => setConfirmingCancel(true)}
                  className="rounded border border-danger/30 bg-surface px-2.5 py-1 text-caption font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Cancel goal
                </button>
              )
            ) : null}
            {client && typeof (client as { killSwitch?: unknown }).killSwitch === 'function' ? (
              confirmingKillSwitch ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption font-medium text-danger">Stops all live campaigns in workspace:</span>
                  <button
                    type="button"
                    disabled={pausingTarget !== null}
                    onClick={handleKillSwitch}
                    className="rounded border border-danger bg-danger px-2.5 py-1 text-caption font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {pausingTarget === 'kill_switch' ? 'Stopping all…' : 'Confirm kill-switch'}
                  </button>
                  <button
                    type="button"
                    disabled={pausingTarget !== null}
                    onClick={() => setConfirmingKillSwitch(false)}
                    className="rounded border border-input/70 bg-surface px-2 py-1 text-caption text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pausingTarget !== null}
                  onClick={() => setConfirmingKillSwitch(true)}
                  className="rounded border border-danger/50 bg-danger/10 px-2.5 py-1 text-caption font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                >
                  Kill-switch
                </button>
              )
            ) : null}
          </div>
        </div>
        {pauseError ? <p className="mt-1 text-caption text-danger">{pauseError}</p> : null}
        <PlatformDeliveryMatrix
          campaigns={now.campaigns}
          variants={variants}
          onPauseCampaign={!isCancelled && client && typeof client.pauseCampaign === 'function' ? handlePauseCampaign : undefined}
          onCancelCampaign={!isCancelled && client && typeof client.cancelCampaign === 'function' ? handleCancelCampaign : undefined}
          onEnhanceVariant={
            !isCancelled && client && typeof client.enhanceGoalCreative === 'function' ? setEnhancingVariant : undefined
          }
          onPromoteVariant={
            !isCancelled && client && typeof client.promoteGoalCreative === 'function'
              ? async (variant) => {
                  await client.promoteGoalCreative!(goalId, variant.id);
                  setLocalRefresh((n) => n + 1);
                }
              : undefined
          }
          pausingId={pausingTarget}
        />
        {enhancingVariant && client && typeof client.enhanceGoalCreative === 'function' && (
          <EnhanceCreativeModal
            variant={enhancingVariant}
            onClose={() => setEnhancingVariant(null)}
            onSubmit={async (input) => {
              await client.enhanceGoalCreative!(goalId, enhancingVariant.id, input);
              setLocalRefresh((n) => n + 1);
            }}
          />
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">What Proba did for you</h2>
        <div className="mt-1.5 grid gap-2 rounded-lg border bg-surface-sunken/50 p-3 text-body sm:grid-cols-3">
          <div>
            <p className="text-caption text-muted-foreground">Platforms managed</p>
            <p className="font-semibold text-foreground">
              {now.campaigns.length === 0
                ? 'Awaiting launch'
                : `${now.campaigns.filter((c) => c.delivery?.state === 'delivering').length} active · ${now.campaigns.length} total`}
            </p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">Autonomous checks</p>
            <p className="font-semibold text-foreground">
              {decisions.length === 0 ? 'Monitoring live metrics' : `${decisions.length} review${decisions.length === 1 ? '' : 's'} logged`}
            </p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">Spend &amp; pacing</p>
            <p className="font-semibold text-foreground">
              {money(spend.spent, spend.currency)}{' '}
              {(spend.totalCap ?? spend.dailyCap) !== null ? `/ ${money(spend.totalCap ?? spend.dailyCap, spend.currency)}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Recent decisions</h2>
        {decisions.length === 0 ? (
          <p className="mt-1 text-body text-muted-foreground">No reviews yet. Proba reviews the campaign once it has been live long enough to judge.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {decisions.map((d) => (
              <li key={`${d.at}-${d.probaCampaignId}`} className="text-body">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{d.kind === 'checkpoint' ? `Checkpoint ${String(d.checkpoint?.checkpoint ?? '')}` : 'Review'}</Badge>
                  {d.decision ? <Badge>{d.decision}</Badge> : null}
                  {d.proposal ? <Badge>{`${d.proposal.verb.replace('ads.', '').replace('_', ' ')} · ${d.proposal.status}`}</Badge> : null}
                  <span className="text-caption text-muted-foreground">{formatRelativeTime(d.at)}</span>
                </div>
                {d.summary ? <p className="mt-0.5 text-foreground">{d.summary}</p> : null}
                {d.whyNowOrNotYet ? <p className="text-caption text-muted-foreground">Why: {d.whyNowOrNotYet}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
