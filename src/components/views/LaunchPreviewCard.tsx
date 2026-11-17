import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Rocket, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { AskPayload } from '../../lib/protocol';
import type { IncomingEvent } from '../../lib/transport';
import { formatCurrency } from '../../lib/utils/format';
import { cn } from '../../lib/utils/cn';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const THINKING_STEPS = [
  'Scanning your landing page & pricing...',
  'Extracting your strongest hook & audience...',
  'Crafting native Meta & Reddit creatives...',
  'Finalizing launch preview...',
];

interface LaunchPreviewCardProps {
  goalTitle: string;
  event?: IncomingEvent;
  ask: AskPayload | undefined;
  status?: { state: string; detail?: string; message?: string } | null;
  assistantReply?: string | null;
  onReply?: (text: string) => Promise<void>;
  isPublishing?: boolean;
  isInstantManaged?: boolean;
  dailyBudget?: number;
  currency?: string;
  landingPageUrl?: string;
  hasConnectedPlatform: boolean;
  canSwitchMode?: boolean;
  onConnectPlatform?: (provider: 'meta' | 'reddit') => void;
  onLaunch: (edited?: { headline?: string; body?: string; imageUrl?: string }) => Promise<void>;
  onSwitchToControlled: () => void;
  submitting?: boolean;
}

export function LaunchPreviewCard({
  goalTitle,
  event,
  ask,
  status = null,
  assistantReply = null,
  onReply,
  isPublishing = false,
  isInstantManaged = false,
  dailyBudget = 20,
  currency = 'USD',
  landingPageUrl,
  hasConnectedPlatform,
  canSwitchMode = true,
  onConnectPlatform,
  onLaunch,
  onSwitchToControlled,
  submitting = false,
}: LaunchPreviewCardProps) {
  const uiProps = (event?.ui?.props ?? {}) as Record<string, unknown>;
  const draft = (uiProps.creativeDraft ?? uiProps.draft ?? uiProps.creative ?? uiProps) as Record<string, unknown>;
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
  const [imgFailed, setImgFailed] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  useEffect(() => {
    setHeadline(initialHeadline);
    setBody(initialBody);
    setImageUrl(initialImage);
    setImgFailed(false);
  }, [initialHeadline, initialBody, initialImage]);

  useEffect(() => {
    if (ask || status?.state === 'error') {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const stepTimer = window.setInterval(() => {
      setThinkingStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1));
    }, 3500);
    const secTimer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(secTimer);
    };
  }, [ask, status?.state]);

  if (!ask) {
    const liveMessage = status?.message || status?.detail;
    if (assistantReply && status?.state !== 'error') {
      return (
        <div className="rounded-2xl border border-amber-200 bg-white p-6 text-[#09090B] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-caption font-semibold text-amber-800">
              Agent Needs Details
            </span>
            <div className="flex items-center gap-3">
              <a href="#/goals" className="text-caption font-semibold text-[#2563EB] hover:underline">
                Try another URL
              </a>
              {canSwitchMode && (
                <button
                  type="button"
                  onClick={onSwitchToControlled}
                  className="inline-flex items-center gap-1 text-caption font-medium text-slate-500 hover:text-[#09090B]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Pro View
                </button>
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#09090B]">{goalTitle}</h2>
          <div className="whitespace-pre-wrap rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-body text-slate-700 leading-relaxed">
            {assistantReply}
          </div>
          {onReply && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = replyText.trim();
                if (!trimmed || replyBusy) return;
                setReplyBusy(true);
                try {
                  await onReply(trimmed);
                  setReplyText('');
                } finally {
                  setReplyBusy(false);
                }
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Describe your product/Reel or paste a landing page URL…"
                className="h-11 flex-1 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-body text-[#09090B] focus:border-[#2563EB] focus:outline-none"
              />
              <button
                type="submit"
                disabled={replyBusy || !replyText.trim()}
                className="h-11 rounded-xl bg-[#2563EB] px-5 text-body font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {replyBusy ? 'Sending…' : 'Send & Continue'}
              </button>
            </form>
          )}
        </div>
      );
    }
    if (status?.state === 'error') {
      return (
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-[#09090B] shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-caption font-semibold text-red-700">
              Action Needed
            </span>
            {canSwitchMode && (
              <button
                type="button"
                onClick={onSwitchToControlled}
                className="inline-flex items-center gap-1 text-caption font-medium text-slate-500 hover:text-[#09090B]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Pro View
              </button>
            )}
          </div>
          <h2 className="mt-3 text-xl font-bold text-[#09090B]">{goalTitle}</h2>
          <p className="mt-2 rounded-xl border border-red-100 bg-red-50/70 p-3.5 text-body text-red-800">
            {liveMessage || 'The agent encountered an error while preparing this campaign.'}
          </p>
          {onConnectPlatform && !hasConnectedPlatform && !isInstantManaged && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onConnectPlatform('meta')}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-caption font-semibold text-[#09090B] hover:bg-slate-50"
              >
                Connect Meta
              </button>
              <button
                type="button"
                onClick={() => onConnectPlatform('reddit')}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-caption font-semibold text-[#09090B] hover:bg-slate-50"
              >
                Connect Reddit
              </button>
            </div>
          )}
        </div>
      );
    }

    if (isPublishing) {
      return (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-[#09090B] shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-caption font-semibold text-emerald-700">
              <Rocket className="h-3.5 w-3.5 animate-pulse" />
              Publishing Campaign
            </span>
            <span className="font-mono text-[11px] text-slate-500">{elapsedSec}s</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-[#09090B]">{goalTitle}</h2>
          <p className="mt-1.5 text-body text-slate-600">
            {liveMessage || 'Creating your campaign and ad set on connected ad platforms…'}
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-[#09090B] shadow-sm lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-1 text-caption font-semibold text-[#09090B]">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#10B981]" />
                Building Campaign
              </span>
              <span className="font-mono text-[11px] text-slate-500">{elapsedSec}s</span>
            </div>
            {canSwitchMode && (
              <button
                type="button"
                onClick={onSwitchToControlled}
                className="inline-flex items-center gap-1 text-caption font-medium text-slate-500 hover:text-[#09090B]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Pro View
              </button>
            )}
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#09090B]">{goalTitle}</h2>
          {liveMessage && (
            <p className="mt-1 text-caption font-medium text-slate-600">{liveMessage}</p>
          )}
          <div className="mt-4 space-y-2">
            {THINKING_STEPS.map((label, idx) => (
              <div
                key={label}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-caption transition-all',
                  idx === thinkingStep
                    ? 'border-[#18181B] bg-[#FAFAFA] font-semibold text-[#09090B]'
                    : idx < thinkingStep
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                      : 'border-[#E5E7EB] bg-white text-slate-400'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      idx === thinkingStep ? 'animate-pulse bg-[#18181B]' : idx < thinkingStep ? 'bg-[#10B981]' : 'bg-slate-300'
                    )}
                  />
                  <span>{label}</span>
                </div>
                {idx === thinkingStep && (
                  <span className="font-mono text-[10px] font-medium text-slate-500">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <span className="text-caption font-semibold uppercase tracking-wide text-slate-500">
              Live Ad Draft Preview
            </span>
            <span className="font-mono text-[11px] text-slate-400">Meta · Reddit</span>
          </div>
          <div className="my-4 space-y-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-5">
            <div className="h-36 w-full animate-pulse rounded-lg bg-slate-200/70" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200/80" />
            <div className="h-3.5 w-full animate-pulse rounded bg-slate-200/60" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-200/60" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Cap: {formatCurrency(dailyBudget, currency)}/day</span>
            <span>Preparing preview…</span>
          </div>
        </div>
      </div>
    );
  }

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
  const rationale = typeof draft.rationale === 'string' && draft.rationale.trim() ? draft.rationale.trim() : null;
  const planReasons =
    plan.reasons && typeof plan.reasons === 'object' && !Array.isArray(plan.reasons)
      ? Object.entries(plan.reasons as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 3)
          .map(([k, v]) => ({ key: k, reason: String(v) }))
      : [];

  return (
    <div className="rounded-2xl border border-[#2563EB]/40 bg-white p-6 text-[#0B0D12] shadow-md ring-4 ring-[#2563EB]/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>
              Agent Decision Ready
            </Badge>
            <Badge tone="neutral">{platformLabel}</Badge>
            <Badge tone={hasConnectedPlatform ? 'success' : 'neutral'}>
              {hasConnectedPlatform ? 'Account: Your Account' : 'Account: Smallseed Managed'}
            </Badge>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[#0B0D12]">{goalTitle}</h2>
        </div>
        {canSwitchMode && (
          <button
            type="button"
            onClick={onSwitchToControlled}
            className="inline-flex items-center gap-1.5 text-caption font-medium text-slate-500 hover:text-[#0B0D12]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Pro View
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Ad Preview ({platformLabel})
          </div>
          {imageUrl && !imgFailed && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
              <img src={imageUrl} alt={headline} onError={() => setImgFailed(true)} className="h-44 w-full object-cover" />
            </div>
          )}
          <p className="mt-3 text-body font-semibold text-[#0B0D12]">{headline}</p>
          <p className="mt-1 whitespace-pre-wrap text-caption text-slate-600 line-clamp-4">{body}</p>
          {destination && (
            <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[11px] text-slate-500">
              <span className="truncate">{destination}</span>
              <span className="rounded bg-[#2563EB] px-2 py-0.5 font-semibold text-white">
                {typeof draft.ctaType === 'string' ? draft.ctaType.replace(/_/g, ' ') : 'Learn More'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <dl className="space-y-3 text-body">
            <div>
              <dt className="text-caption text-slate-500">Platform &amp; Audience</dt>
              <dd className="font-semibold text-[#0B0D12]">
                {platformLabel}
                {communities ? ` · ${communities}` : ' · High-intent buyers matched from your site'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-slate-500">Daily Spend Cap</dt>
              <dd className="font-mono text-lg font-bold tabular-nums text-[#0B0D12]">
                {formatCurrency(budgetValue, budgetCurrency)} / day
              </dd>
            </div>
            {destination && (
              <div>
                <dt className="text-caption text-slate-500">Destination URL</dt>
                <dd className="truncate text-caption">
                  <a href={destination} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">
                    {destination}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
            {(rationale || planReasons.length > 0) && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-caption">
                <dt className="font-semibold text-[#0B0D12]">Why Proba chose this</dt>
                {rationale && <dd className="mt-1 text-slate-600">{rationale}</dd>}
                {planReasons.length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-[12px] text-slate-600">
                    {planReasons.map((r) => (
                      <li key={r.key}>
                        <span className="font-semibold capitalize text-[#0B0D12]">{r.key}:</span> {r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-caption text-[#166534]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#65A30D]" />
              <span>Hard daily cap enforced. Proba pauses automatically if performance drops.</span>
            </div>
          </dl>

          {!hasConnectedPlatform && !isInstantManaged && onConnectPlatform && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-caption font-semibold text-amber-900">Connect an ad platform to publish</p>
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
        <div className="mt-5 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-4">
          <div className="text-caption font-semibold text-[#0B0D12]">Edit ad details</div>
          <div className="space-y-1">
            <label className="text-caption text-slate-600">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-body text-[#0B0D12]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-slate-600">Body copy</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-body text-[#0B0D12]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-slate-600">Image URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-body text-[#0B0D12]"
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-caption font-semibold text-[#0B0D12] hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? 'Done editing' : 'Edit details'}
        </button>

        <button
          type="button"
          disabled={submitting || (!hasConnectedPlatform && !isInstantManaged)}
          onClick={() => {
            const hasEdits = headline !== initialHeadline || body !== initialBody || imageUrl !== initialImage;
            void onLaunch(hasEdits ? { headline, body, imageUrl: imageUrl || undefined } : undefined);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-2.5 text-body font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          <Rocket className="h-4 w-4" />
          {submitting ? 'Launching…' : `Launch Campaign (${formatCurrency(budgetValue, budgetCurrency)}/day)`}
        </button>
      </div>
    </div>
  );
}
