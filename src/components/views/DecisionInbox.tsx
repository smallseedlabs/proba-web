import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Sparkles, X } from 'lucide-react';
import type { GoalStatus, Proposal } from '../../lib/actions/client';
import { getPlatformSpec } from '../../lib/platforms/registry';
import { useActionsClient } from '../../state/actions';
import { useOpenAsks } from '../../state/hooks';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';

function formatProposalVerb(verb: string, args: Record<string, unknown>): string {
  if (verb === 'ads.pause_campaign') return 'Pause campaign';
  if (verb === 'ads.update_campaign') {
    const budget = typeof args.dailyBudget === 'number' ? args.dailyBudget : null;
    return budget !== null ? `Update daily budget to ${budget}` : 'Update campaign';
  }
  if (verb === 'ads.rebalance_budget') return 'Rebalance cross-platform budget';
  return verb.replace('ads.', '').replace(/_/g, ' ');
}

/**
 * Exception-driven Decision Inbox: surfaces only drastic changes, pending approvals, or
 * platform delivery blocks. Stays out of the way when automation is running cleanly.
 */
export function DecisionInbox({
  goalId,
  threadId,
  goalStatus,
  onOpenCopilot,
}: {
  goalId: string;
  threadId?: string;
  goalStatus: GoalStatus | null;
  onOpenCopilot?: () => void;
}) {
  const client = useActionsClient();
  const { notify } = useToast();
  const openAsks = useOpenAsks().filter((a) => !threadId || a.threadId === threadId);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !goalStatus || typeof client.listProposals !== 'function') {
      setProposals([]);
      return;
    }
    const ids = new Set(goalStatus.now.campaigns.map((c) => c.probaCampaignId));
    if (ids.size === 0) {
      setProposals([]);
      return;
    }
    const controller = new AbortController();
    client
      .listProposals(controller.signal)
      .then((all) => {
        if (!controller.signal.aborted) {
          setProposals(all.filter((p) => p.status === 'pending' && ids.has(p.probaCampaignId)));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setProposals([]);
      });
    return () => controller.abort();
  }, [client, goalStatus]);

  const decide = async (proposal: Proposal, decision: 'approve' | 'reject') => {
    if (!client) return;
    setBusyId(proposal.id);
    try {
      await client.decide(proposal.id, decision);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
      notify({
        tone: decision === 'approve' ? 'success' : 'neutral',
        title: decision === 'approve' ? 'Change approved and sent to platform' : 'Proposal dismissed',
      });
    } catch (err) {
      notify({
        tone: 'danger',
        title: 'Could not apply decision',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const blockedCampaigns = (goalStatus?.now.campaigns ?? []).filter(
    (c) => c.delivery && (c.delivery.state === 'rejected' || c.delivery.state === 'not_delivering')
  );

  if (proposals.length === 0 && openAsks.length === 0 && blockedCampaigns.length === 0) {
    return null;
  }

  return (
    <section aria-label="AI Decision Inbox" className="mb-6 space-y-3">
      {proposals.map((p) => {
        const spec = getPlatformSpec(p.platform);
        const busy = busyId === p.id;
        return (
          <div
            key={p.id}
            className="rounded-xl border border-primary/30 bg-primary-subtle/40 p-4 shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-caption font-semibold uppercase tracking-wide text-primary">
                    Proba Recommendation · {spec.displayName}
                  </span>
                  <Badge tone="warning">Approval needed</Badge>
                </div>
                <p className="text-body font-semibold text-foreground">
                  {formatProposalVerb(p.verb, p.args)}
                </p>
                {p.reason ? <p className="text-body text-muted-foreground">{p.reason}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => void decide(p, 'approve')}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void decide(p, 'reject')}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {openAsks.length > 0 && onOpenCopilot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-subtle/40 p-4 shadow-card">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-body font-semibold text-foreground">
                {openAsks.length === 1
                  ? '1 action is waiting for your approval'
                  : `${openAsks.length} actions are waiting for your approval`}
              </p>
              <p className="text-caption text-muted-foreground">
                Review and approve in the Co-pilot panel so Proba can execute on your connected platforms.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenCopilot}>
            Review in Co-pilot
          </Button>
        </div>
      )}

      {blockedCampaigns.map((c) => {
        const spec = getPlatformSpec(c.platform);
        return (
          <div
            key={`blocked-${goalId}-${c.probaCampaignId}`}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warning/40 bg-warning-subtle/30 p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                <span className="text-body font-semibold text-foreground">
                  {spec.displayName}: {c.delivery!.label}
                </span>
              </div>
              <p className="text-caption text-muted-foreground">{c.delivery!.summary}</p>
            </div>
            {onOpenCopilot && (
              <Button size="sm" variant="outline" onClick={onOpenCopilot}>
                Ask Proba to fix
              </Button>
            )}
          </div>
        );
      })}
    </section>
  );
}
