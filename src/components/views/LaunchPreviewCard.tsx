import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Rocket, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { AskPayload } from '../../lib/protocol';
import type { IncomingEvent } from '../../lib/transport';
import { formatCurrency } from '../../lib/utils/format';
import { cn } from '../../lib/utils/cn';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const THINKING_STEPS = [
  '🔍 Scanning your landing page & pricing...',
  '🧠 Extracting your strongest hook & audience...',
  '🎨 Crafting native Meta & Reddit creatives...',
  '✨ Finalizing launch preview...',
];

const VIBE_OPTIONS = [
  { id: 'bold', label: '🔥 Bold' },
  { id: 'founder', label: '😎 Founder Story' },
  { id: 'meme', label: '😂 Meme-y' },
] as const;

interface LaunchPreviewCardProps {
  goalTitle: string;
  event?: IncomingEvent;
  ask: AskPayload | undefined;
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
  const [vibe, setVibe] = useState<'bold' | 'founder' | 'meme'>('bold');
  const [thinkingStep, setThinkingStep] = useState(0);

  useEffect(() => {
    setHeadline(initialHeadline);
    setBody(initialBody);
    setImageUrl(initialImage);
  }, [initialHeadline, initialBody, initialImage]);

  useEffect(() => {
    if (ask) return;
    const t = window.setInterval(() => {
      setThinkingStep((s) => (s + 1) % THINKING_STEPS.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [ask]);

  // Agent Thinking Live Theater while preparing
  if (!ask) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12121A] p-8 shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-caption font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Proba Agent Working
          </div>
          {canSwitchMode && (
            <button
              type="button"
              onClick={onSwitchToControlled}
              className="inline-flex items-center gap-1 text-caption text-slate-400 hover:text-white"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Pro View
            </button>
          )}
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">{goalTitle}</h2>
        <div className="mt-5 space-y-2.5">
          {THINKING_STEPS.map((label, idx) => (
            <div
              key={label}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-body transition-all',
                idx === thinkingStep
                  ? 'border-violet-500/50 bg-violet-500/10 text-white'
                  : idx < thinkingStep
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                    : 'border-white/5 bg-white/[0.02] text-slate-500'
              )}
            >
              <span>{label}</span>
            </div>
          ))}
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

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12121A] p-6 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>
              Ready to launch
            </Badge>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-200">
              {platformLabel}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-white">{goalTitle}</h2>
        </div>
        {canSwitchMode && (
          <button
            type="button"
            onClick={onSwitchToControlled}
            className="inline-flex items-center gap-1.5 text-caption font-medium text-slate-400 hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Pro View
          </button>
        )}
      </div>

      {/* Vibe Remix Pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Vibe:</span>
        {VIBE_OPTIONS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVibe(v.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-medium transition',
              vibe === v.id
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* Left: Ad Visual Preview */}
        <div className="rounded-xl border border-white/10 bg-[#09090D] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Ad Preview ({platformLabel})
          </div>
          {imageUrl && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-white/10 bg-black">
              <img src={imageUrl} alt={headline} className="h-44 w-full object-cover" />
            </div>
          )}
          <p className="mt-3 text-body font-semibold text-white">{headline}</p>
          <p className="mt-1 whitespace-pre-wrap text-caption text-slate-300 line-clamp-4">{body}</p>
          {destination && (
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-slate-400">
              <span className="truncate">{destination}</span>
              <span className="rounded bg-violet-500/20 px-2 py-0.5 font-semibold text-violet-300">
                {typeof draft.ctaType === 'string' ? draft.ctaType.replace(/_/g, ' ') : 'Learn More'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Campaign Summary */}
        <div className="flex flex-col justify-between space-y-4">
          <dl className="space-y-3 text-body">
            <div>
              <dt className="text-caption text-slate-400">Platform &amp; Audience</dt>
              <dd className="font-medium text-white">
                {platformLabel}
                {communities ? ` · ${communities}` : ' · High-intent buyers matched from your site'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-slate-400">Daily Spend Cap</dt>
              <dd className="font-mono text-lg font-bold tabular-nums text-white">
                {formatCurrency(budgetValue, budgetCurrency)} / day
              </dd>
            </div>
            {destination && (
              <div>
                <dt className="text-caption text-slate-400">Destination URL</dt>
                <dd className="truncate text-caption">
                  <a href={destination} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
                    {destination}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-caption text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>Hard daily cap enforced. Proba pauses automatically if performance drops.</span>
            </div>
          </dl>

          {!hasConnectedPlatform && onConnectPlatform && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-caption font-semibold text-amber-200">Connect an ad platform to publish</p>
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
        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-[#09090D] p-4">
          <div className="text-caption font-semibold text-white">Edit ad details</div>
          <div className="space-y-1">
            <label className="text-caption text-slate-400">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#12121A] px-3 py-1.5 text-body text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-slate-400">Body copy</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#12121A] px-3 py-1.5 text-body text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-slate-400">Image URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#12121A] px-3 py-1.5 text-body text-white"
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-caption font-medium text-slate-200 hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? 'Done editing' : 'Edit details'}
        </button>

        <button
          type="button"
          disabled={submitting || !hasConnectedPlatform}
          onClick={() => onLaunch(editing ? { headline, body, imageUrl: imageUrl || undefined } : undefined)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 px-6 py-2.5 text-body font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:opacity-95 disabled:opacity-50"
        >
          <Rocket className="h-4 w-4" />
          {submitting ? 'Launching…' : `Launch Campaign (${formatCurrency(budgetValue, budgetCurrency)}/day)`}
        </button>
      </div>
    </div>
  );
}
