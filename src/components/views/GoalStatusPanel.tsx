import { useEffect, useState } from 'react';
import type { GoalStatus } from '../../lib/actions/client';
import { formatDateTime, formatCurrency, formatNumber, formatRelativeTime } from '../../lib/utils/format';
import { useActionsClient } from '../../state/actions';
import { Badge } from '../ui/badge';
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
  const [pausingTarget, setPausingTarget] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    setStatus(null);
    client
      .getGoalStatus(goalId, controller.signal)
      .then(setStatus)
      .catch(() => setStatus(null));
    return () => controller.abort();
  }, [client, goalId, refreshKey, localRefresh]);

  if (!status) return null;
  const { now, next, spend, progress, decisions, plan } = status;
  const metric = progress.metric;
  const reasons = plan && typeof plan.reasons === 'object' && plan.reasons !== null ? (plan.reasons as Record<string, unknown>) : {};
  const hasPausableCampaign = now.campaigns.some((c) => c.providerCampaignId && c.delivery?.state !== 'paused');

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

  return (
    <section aria-label="Goal status" className="mb-6 rounded-xl border bg-card p-4 shadow-card">
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

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Platforms &amp; delivery status</h2>
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
        </div>
        {pauseError ? <p className="mt-1 text-caption text-danger">{pauseError}</p> : null}
        <PlatformDeliveryMatrix
          campaigns={now.campaigns}
          onPauseCampaign={client && typeof client.pauseCampaign === 'function' ? handlePauseCampaign : undefined}
          pausingId={pausingTarget}
        />
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
