import { useState } from 'react';
import { CheckCircle2, ExternalLink, Pencil, Rocket, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { AskPayload } from '../../lib/protocol';
import type { IncomingEvent } from '../../lib/transport';
import { formatCurrency } from '../../lib/utils/format';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface LaunchPreviewCardProps {
  goalTitle: string;
  event?: IncomingEvent;
  ask: AskPayload | undefined;
  dailyBudget?: number;
  currency?: string;
  landingPageUrl?: string;
  hasConnectedPlatform: boolean;
  onConnectPlatform?: (provider: 'meta' | 'reddit') => void;
  onLaunch: (edited?: { headline?: string; body?: string; imageUrl?: string }) => Promise<void>;
  onSwitchToControlled: () => void;
  submitting?: boolean;
}

export function LaunchPreviewCard({
  goalTitle,
  event,
  ask,
  dailyBudget = 20,
  currency = 'USD',
  landingPageUrl,
  hasConnectedPlatform,
  onConnectPlatform,
  onLaunch,
  onSwitchToControlled,
  submitting = false,
}: LaunchPreviewCardProps) {
  const uiProps = (event?.ui?.props ?? {}) as Record<string, unknown>;
  const draft = (uiProps.draft ?? uiProps.creative ?? uiProps) as Record<string, unknown>;
  const plan = (uiProps.plan ?? {}) as Record<string, unknown>;
  const targeting = (uiProps.targeting ?? {}) as Record<string, unknown>;
  const costImpact = (uiProps.costImpact ?? {}) as Record<string, unknown>;

  const initialHeadline = typeof draft.headline === 'string' ? draft.headline : (ask?.title || goalTitle);
  const initialBody =
    typeof draft.body === 'string'
      ? draft.body
      : ask?.description || 'Proba prepared your campaign copy and audience targeting based on your website.';
  const initialImage =
    typeof draft.imageUrl === 'string'
      ? draft.imageUrl
      : typeof draft.mediaUrl === 'string'
        ? draft.mediaUrl
        : '';

  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(initialHeadline);
  const [body, setBody] = useState(initialBody);
  const [imageUrl, setImageUrl] = useState(initialImage);

  const platform =
    typeof plan.platform === 'string'
      ? plan.platform
      : Array.isArray(targeting.platforms) && typeof targeting.platforms[0] === 'string'
        ? String(targeting.platforms[0]).toLowerCase()
        : 'reddit';

  const platformLabel = platform === 'meta' ? 'Meta Feed' : platform === 'reddit' ? 'Reddit Ads' : platform.toUpperCase();
  const budgetValue =
    typeof costImpact.proposed === 'number'
      ? costImpact.proposed
      : typeof uiProps.dailyBudget === 'number'
        ? uiProps.dailyBudget
        : dailyBudget;
  const budgetCurrency =
    typeof costImpact.currency === 'string'
      ? costImpact.currency
      : typeof uiProps.currency === 'string'
        ? uiProps.currency
        : currency;

  const destination =
    typeof uiProps.landingPageUrl === 'string'
      ? uiProps.landingPageUrl
      : landingPageUrl;

  const communities = Array.isArray(targeting.communities)
    ? (targeting.communities as string[]).slice(0, 4).join(', ')
    : null;

  return (
    <div className="rounded-xl border bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="success" dot>
              Ready to launch
            </Badge>
            <Badge tone="neutral">{platformLabel}</Badge>
          </div>
          <h2 className="mt-2 text-section font-semibold text-foreground">{goalTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onSwitchToControlled}
          className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Switch to Controlled Mode
        </button>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* Left: Ad Visual Preview */}
        <div className="rounded-lg border bg-background p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ad Preview ({platformLabel})
          </div>
          {imageUrl && (
            <div className="mt-2.5 overflow-hidden rounded-md border bg-muted">
              <img src={imageUrl} alt={headline} className="h-44 w-full object-cover" />
            </div>
          )}
          <p className="mt-3 text-body font-semibold text-foreground">{headline}</p>
          <p className="mt-1 whitespace-pre-wrap text-caption text-muted-foreground line-clamp-4">{body}</p>
          {destination && (
            <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
              <span className="truncate">{destination}</span>
              <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {typeof draft.ctaType === 'string' ? draft.ctaType.replace(/_/g, ' ') : 'Learn More'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Campaign Summary */}
        <div className="flex flex-col justify-between space-y-4">
          <dl className="space-y-3 text-body">
            <div>
              <dt className="text-caption text-muted-foreground">Platform &amp; Audience</dt>
              <dd className="font-medium text-foreground">
                {platformLabel}
                {communities ? ` · ${communities}` : ' · High-intent buyers matched from your site'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Daily Spend Cap</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatCurrency(budgetValue, budgetCurrency)} / day max
              </dd>
            </div>
            {destination && (
              <div>
                <dt className="text-caption text-muted-foreground">Destination URL</dt>
                <dd className="truncate text-caption">
                  <a href={destination} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {destination}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-lg border bg-success-subtle/40 p-2.5 text-caption text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>Guarded Auto: Proba enforces your daily cap and pauses if performance drops.</span>
            </div>
          </dl>

          {!hasConnectedPlatform && onConnectPlatform && (
            <div className="rounded-lg border border-warning/40 bg-warning-subtle/40 p-3">
              <p className="text-caption font-semibold text-foreground">Connect an ad platform to publish</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onConnectPlatform('meta')}>
                  Connect Meta
                </Button>
                <Button size="sm" variant="outline" onClick={() => onConnectPlatform('reddit')}>
                  Connect Reddit
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-5 space-y-3 rounded-lg border bg-background p-4">
          <div className="text-caption font-semibold text-foreground">Edit ad details</div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-md border bg-surface px-3 py-1.5 text-body text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">Body copy</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-md border bg-surface px-3 py-1.5 text-body text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">Image URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-md border bg-surface px-3 py-1.5 text-body text-foreground"
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {editing ? 'Done editing' : 'Edit details'}
        </Button>

        <Button
          type="button"
          size="lg"
          disabled={!ask || submitting || !hasConnectedPlatform}
          loading={submitting}
          onClick={() => onLaunch(editing ? { headline, body, imageUrl: imageUrl || undefined } : undefined)}
        >
          {ask ? (
            <>
              <Rocket className="mr-1.5 h-4 w-4" />
              Launch Campaign ({formatCurrency(budgetValue, budgetCurrency)}/day)
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Preparing campaign…
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
