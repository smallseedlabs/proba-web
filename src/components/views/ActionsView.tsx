import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Gauge, Pause, TrendingDown } from 'lucide-react';
import {
  ActionsError,
  PLATFORMS,
  costPerConversion,
  describeProposal,
  metricTotals,
  type ActionsClient,
  type MetricRow,
  type Platform,
  type Proposal,
  type Review,
  type ReviewCampaign,
  type ReviewRules,
} from '../../lib/actions/client';
import { formatDateTime, formatRelativeTime } from '../../lib/utils/format';
import { useActionsClient } from '../../state/actions';
import { useGoals } from '../../state/hooks';
import { Badge, type Tone } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Dialog } from '../ui/dialog';
import { Callout, EmptyState, Spinner } from '../ui/feedback';
import { FieldError, FieldHint, Input, Label, NativeSelect } from '../ui/field';
import { Page, PageHeader } from './common';

const PLATFORM_LABELS: Record<string, string> = { reddit: 'Reddit', microsoft: 'Microsoft Ads', google: 'Google Ads', meta: 'Meta' };

const STATUS_TONES: Record<string, Tone> = {
  pending: 'warning',
  approved: 'info',
  executed: 'success',
  rejected: 'neutral',
  failed: 'danger',
  expired: 'neutral',
  superseded: 'neutral',
};

function showValue(value: number | 'unknown', kind: 'count' | 'money' = 'count'): string {
  if (value === 'unknown') return 'Unknown';
  return kind === 'money' ? value.toFixed(2) : value.toLocaleString();
}

function MetricsSummary({ rows }: { rows: MetricRow[] }) {
  if (rows.length === 0) return <p className="text-body text-muted-foreground">No metrics reported yet. Unknown, not zero.</p>;
  const t = metricTotals(rows);
  const cpc = t.spend !== 'unknown' && t.conversions !== 'unknown' ? costPerConversion({ ...t }) : undefined;
  const items: Array<[string, string]> = [
    ['Spend', showValue(t.spend, 'money')],
    ['Impressions', showValue(t.impressions)],
    ['Clicks', showValue(t.clicks)],
    ['Conversions', showValue(t.conversions)],
    ['Cost per conversion', cpc === undefined ? 'Unknown' : cpc.toFixed(2)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-caption text-muted-foreground">{label}</dt>
          <dd className={value === 'Unknown' ? 'text-body text-muted-foreground' : 'text-body font-semibold tabular-nums'}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function rowsOf(value: unknown): MetricRow[] {
  return Array.isArray(value) ? (value as MetricRow[]) : [];
}

function errorText(error: unknown): string {
  return error instanceof ActionsError ? error.message : 'Something went wrong. Try again.';
}

interface Data {
  campaigns: ReviewCampaign[];
  reviews: Review[];
  proposals: Proposal[];
}

function useActionsData(client: ActionsClient | null) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!client) return;
      try {
        const [campaigns, reviews, proposals] = await Promise.all([
          client.listCampaigns(signal),
          client.listReviews(signal),
          client.listProposals(signal),
        ]);
        setData({ campaigns, reviews, proposals });
        setError(null);
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'AbortError') return;
        setError(errorText(e));
      }
    },
    [client]
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { data, error, reload: load };
}

function ProposalCard({ proposal, onDecide }: { proposal: Proposal; onDecide: (p: Proposal, d: 'approve' | 'reject') => void }) {
  const Icon = proposal.verb === 'ads.pause_campaign' ? Pause : TrendingDown;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body font-semibold text-foreground">
            <Icon className="h-4 w-4 text-warning" aria-hidden="true" />
            {describeProposal(proposal)}
          </p>
          <p className="mt-0.5 text-body text-muted-foreground">
            {proposal.probaCampaignId} · {PLATFORM_LABELS[proposal.platform] ?? proposal.platform}
            {proposal.accountId ? ` · account ${proposal.accountId}` : ''}
          </p>
          {proposal.reason && <p className="mt-1 text-body text-foreground/85">Why: {proposal.reason}</p>}
          <p className="mt-1 text-caption text-muted-foreground">
            Decide before {formatDateTime(proposal.reviewWindowUntil)}. Nothing changes unless you approve.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => onDecide(proposal, 'reject')}>
            Reject
          </Button>
          <Button size="sm" onClick={() => onDecide(proposal, 'approve')}>
            Approve
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <MetricsSummary rows={rowsOf(proposal.metrics)} />
      </div>
    </li>
  );
}

function num(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function RegisterCampaignForm({ client, onDone }: { client: ActionsClient; onDone: () => void }) {
  const goals = useGoals();
  const [goalId, setGoalId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [accountId, setAccountId] = useState('');
  const [providerCampaignId, setProviderCampaignId] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('');
  const [pauseSpend, setPauseSpend] = useState('');
  const [pauseConversions, setPauseConversions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!goalId || !campaignId.trim() || !platform) {
      setError('Choose a goal and platform, and enter the Proba campaign ID.');
      return;
    }
    const dailyBudget = num(budget);
    if (dailyBudget !== undefined && !(dailyBudget > 0)) {
      setError('Leave the current daily budget empty if you do not know it, or enter an amount above zero.');
      return;
    }
    const minSpend = num(pauseSpend);
    const maxConversions = num(pauseConversions);
    let rules: ReviewRules | undefined;
    if (minSpend !== undefined || maxConversions !== undefined) {
      if (minSpend === undefined || maxConversions === undefined || Number.isNaN(minSpend) || Number.isNaN(maxConversions)) {
        setError('For a pause rule, enter both the minimum spend and the maximum conversions.');
        return;
      }
      rules = { pauseWhen: { minSpend, maxConversions } };
    }
    setSaving(true);
    try {
      await client.registerCampaign({
        goalId,
        probaCampaignId: campaignId.trim(),
        platform,
        ...(accountId.trim() ? { accountId: accountId.trim() } : {}),
        ...(providerCampaignId.trim() ? { providerCampaignId: providerCampaignId.trim() } : {}),
        ...(dailyBudget !== undefined ? { currentDailyBudget: dailyBudget } : {}),
        ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
        ...(rules ? { rules } : {}),
      });
      setError(null);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-label="Register a campaign for review" className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor={`${id}-goal`} required>
          Goal
        </Label>
        <NativeSelect id={`${id}-goal`} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">Choose a goal</option>
          {goals.map((g) => (
            <option key={g.goalId} value={g.goalId}>
              {g.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor={`${id}-platform`} required>
          Platform
        </Label>
        <NativeSelect id={`${id}-platform`} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
          <option value="">Choose a platform</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor={`${id}-campaign`} required>
          Proba campaign ID
        </Label>
        <Input id={`${id}-campaign`} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} autoComplete="off" />
      </div>
      <div>
        <Label htmlFor={`${id}-account`}>Ad account ID</Label>
        <Input id={`${id}-account`} value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" />
      </div>
      <div>
        <Label htmlFor={`${id}-provider`}>Platform campaign ID</Label>
        <Input id={`${id}-provider`} value={providerCampaignId} onChange={(e) => setProviderCampaignId(e.target.value)} autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${id}-budget`}>Current daily budget</Label>
          <Input id={`${id}-budget`} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} aria-describedby={`${id}-budget-hint`} />
          <FieldHint id={`${id}-budget-hint`}>Leave empty if unknown. Needed for cap proposals.</FieldHint>
        </div>
        <div>
          <Label htmlFor={`${id}-currency`}>Currency</Label>
          <Input id={`${id}-currency`} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} autoComplete="off" />
        </div>
      </div>
      <fieldset className="md:col-span-2">
        <legend className="text-body font-medium text-foreground">Pause rule (optional)</legend>
        <p className="text-caption text-muted-foreground">Scheduled reviews propose a pause when spend reaches this and conversions stay at or below the limit.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${id}-minspend`}>Minimum spend</Label>
            <Input id={`${id}-minspend`} inputMode="decimal" value={pauseSpend} onChange={(e) => setPauseSpend(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`${id}-maxconv`}>Maximum conversions</Label>
            <Input id={`${id}-maxconv`} inputMode="numeric" value={pauseConversions} onChange={(e) => setPauseConversions(e.target.value)} />
          </div>
        </div>
      </fieldset>
      <div className="md:col-span-2">
        <FieldError id={`${id}-error`}>{error ?? undefined}</FieldError>
        <Button type="submit" loading={saving} className="mt-2">
          Register campaign
        </Button>
      </div>
    </form>
  );
}

function CampaignRow({
  campaign,
  client,
  onChanged,
  onError,
}: {
  campaign: ReviewCampaign;
  client: ActionsClient;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [cap, setCap] = useState('');
  const id = useId();
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const capValue = num(cap);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-body font-semibold text-foreground">{campaign.probaCampaignId}</p>
          <p className="text-body text-muted-foreground">
            {PLATFORM_LABELS[campaign.platform] ?? campaign.platform}
            {campaign.accountId ? ` · account ${campaign.accountId}` : ''} · daily budget{' '}
            {campaign.currentDailyBudget === null ? 'unknown' : `${campaign.currentDailyBudget}${campaign.currency ? ` ${campaign.currency}` : ''}`}
          </p>
          <p className="text-caption text-muted-foreground">
            {campaign.rules.pauseWhen
              ? `Pause rule: spend ≥ ${campaign.rules.pauseWhen.minSpend} with ≤ ${campaign.rules.pauseWhen.maxConversions} conversions`
              : 'No pause rule'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-body text-foreground">
          <input
            type="checkbox"
            checked={campaign.reviewEnabled}
            onChange={(e) => void run('toggle', () => client.updateCampaign(campaign.probaCampaignId, { reviewEnabled: e.target.checked }))}
          />
          Scheduled reviews
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Button size="sm" variant="outline" loading={busy === 'report'} onClick={() => void run('report', () => client.requestReview(campaign.probaCampaignId, { intent: 'report' }))}>
          Run report
        </Button>
        <Button size="sm" variant="outline" loading={busy === 'pause'} onClick={() => void run('pause', () => client.requestReview(campaign.probaCampaignId, { intent: 'propose_pause' }))}>
          Propose pause
        </Button>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor={`${id}-cap`}>New lower cap</Label>
            <Input id={`${id}-cap`} inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className="w-28" />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={capValue === undefined || !(capValue > 0) || campaign.currentDailyBudget === null}
            loading={busy === 'cap'}
            onClick={() => void run('cap', () => client.requestReview(campaign.probaCampaignId, { intent: 'propose_cap', dailyBudget: capValue }))}
          >
            Propose cap
          </Button>
        </div>
      </div>
    </li>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const tone: Tone = review.status === 'completed' ? (review.outcome === 'dry_run_proposal' ? 'warning' : 'success') : 'danger';
  const label =
    review.status !== 'completed'
      ? review.status === 'running'
        ? 'Running'
        : `Not completed${review.errorCode ? ` (${review.errorCode})` : ''}`
      : review.outcome === 'dry_run_proposal'
        ? 'Proposed an action'
        : 'Report';
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-medium text-foreground">
          {review.probaCampaignId} <span className="text-muted-foreground">· {review.trigger === 'schedule' ? 'scheduled' : 'on request'}</span>
        </p>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <time dateTime={review.createdAt} className="text-caption text-muted-foreground">
            {formatRelativeTime(review.createdAt)}
          </time>
        </div>
      </div>
      {review.summary && (
        <div className="mt-3">
          <MetricsSummary rows={review.summary.metrics ?? []} />
          {review.summary.unknownMetrics && (
            <p className="mt-2 text-caption text-muted-foreground">Some metrics are unknown, so no rule can trigger an action from them.</p>
          )}
        </div>
      )}
    </li>
  );
}

export function ActionsView() {
  const client = useActionsClient();
  const { data, error, reload } = useActionsData(client);
  const [notice, setNotice] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [confirm, setConfirm] = useState<{ proposal: Proposal; decision: 'approve' | 'reject' } | null>(null);
  const [deciding, setDeciding] = useState(false);

  const pending = useMemo(() => data?.proposals.filter((p) => p.status === 'pending') ?? [], [data]);
  const decided = useMemo(() => data?.proposals.filter((p) => p.status !== 'pending').slice(0, 20) ?? [], [data]);

  const decide = async () => {
    if (!client || !confirm) return;
    setDeciding(true);
    try {
      const result = await client.decide(confirm.proposal.id, confirm.decision);
      setNotice(
        result.status === 'executed'
          ? 'Approved and applied.'
          : result.status === 'rejected'
            ? 'Rejected. Nothing was changed.'
            : `The action did not complete${typeof result.outcome?.code === 'string' ? ` (${result.outcome.code})` : ''}. Nothing else was changed.`
      );
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setDeciding(false);
      setConfirm(null);
      void reload();
    }
  };

  if (!client) {
    return (
      <Page>
        <PageHeader title="Reviews" />
        <div className="mt-8">
          <Card>
            <EmptyState icon={<Gauge className="h-6 w-6" />} title="Reviews are not available here" description="Campaign reviews and proposed actions need a connected Proba Hub." />
          </Card>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Reviews"
        description="Proba reviews each registered campaign and may propose pausing it or lowering its daily budget cap. Nothing changes until you approve, and each campaign is reviewed on its own platform only."
        actions={
          <Button variant="outline" onClick={() => setRegistering((v) => !v)}>
            {registering ? 'Close' : 'Register campaign'}
          </Button>
        }
      />
      <div className="mt-6 space-y-6" aria-live="polite">
        {notice && (
          <Callout tone="info" onDismiss={() => setNotice(null)} role="status">
            {notice}
          </Callout>
        )}
        {error && (
          <Callout tone="danger" role="alert" actions={<Button size="sm" variant="outline" onClick={() => void reload()}>Try again</Button>}>
            {error}
          </Callout>
        )}
        {registering && (
          <Card>
            <CardHeader title="Register a campaign for review" titleAs="h2" description="One platform and ad account per registration. Moving budget between platforms is a separate step." />
            <CardBody>
              <RegisterCampaignForm
                client={client}
                onDone={() => {
                  setRegistering(false);
                  setNotice('Campaign registered for review.');
                  void reload();
                }}
              />
            </CardBody>
          </Card>
        )}
        {!data && !error && <Spinner label="Loading reviews" />}
        {data && (
          <>
            <Card>
              <CardHeader title="Waiting for your decision" titleAs="h2" description="Approving applies exactly this change. Rejecting leaves the campaign as it is." />
              <CardBody className="p-0">
                {pending.length === 0 ? (
                  <p className="px-5 py-4 text-body text-muted-foreground">No proposed actions right now.</p>
                ) : (
                  <ul className="divide-y">
                    {pending.map((p) => (
                      <ProposalCard key={p.id} proposal={p} onDecide={(proposal, decision) => setConfirm({ proposal, decision })} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Registered campaigns" titleAs="h2" />
              <CardBody className="p-0">
                {data.campaigns.length === 0 ? (
                  <p className="px-5 py-4 text-body text-muted-foreground">No campaigns are registered for review yet.</p>
                ) : (
                  <ul className="divide-y">
                    {data.campaigns.map((c) => (
                      <CampaignRow key={c.probaCampaignId} campaign={c} client={client} onChanged={() => void reload()} onError={setNotice} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent reports" titleAs="h2" />
              <CardBody className="p-0">
                {data.reviews.length === 0 ? (
                  <p className="px-5 py-4 text-body text-muted-foreground">No reviews have run yet.</p>
                ) : (
                  <ul className="divide-y">
                    {data.reviews.slice(0, 20).map((r) => (
                      <ReviewRow key={r.id} review={r} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {decided.length > 0 && (
              <Card>
                <CardHeader title="Decided" titleAs="h2" />
                <CardBody className="p-0">
                  <ul className="divide-y">
                    {decided.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <p className="text-body text-foreground">
                          {describeProposal(p)} <span className="text-muted-foreground">· {p.probaCampaignId}</span>
                        </p>
                        <Badge tone={STATUS_TONES[p.status] ?? 'neutral'}>
                          {p.status}
                          {p.status === 'failed' && typeof p.outcome?.code === 'string' ? `: ${p.outcome.code}` : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm?.decision === 'approve' ? 'Approve this change?' : 'Reject this proposal?'}
        description={
          confirm
            ? confirm.decision === 'approve'
              ? `${describeProposal(confirm.proposal)} (${confirm.proposal.probaCampaignId}). This is applied on ${PLATFORM_LABELS[confirm.proposal.platform] ?? confirm.proposal.platform} only.`
              : 'The campaign stays as it is.'
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} data-autofocus>
              Cancel
            </Button>
            <Button variant={confirm?.decision === 'approve' ? 'primary' : 'danger-outline'} loading={deciding} onClick={() => void decide()}>
              {confirm?.decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      />
    </Page>
  );
}
