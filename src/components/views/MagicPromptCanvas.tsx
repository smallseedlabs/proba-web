import { useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, Globe, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { formatRelativeTime } from '../../lib/utils/format';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import type { GoalView } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';

const BUDGET_PILLS = [
  { amount: 10, label: '$10/day', tag: 'Test Waters', estClicks: '25–45 clicks/day' },
  { amount: 25, label: '$25/day', tag: 'Sweet Spot ✨', estClicks: '70–120 clicks/day' },
  { amount: 50, label: '$50/day', tag: 'Send It 🚀', estClicks: '150–260 clicks/day' },
] as const;

const DEMO_CHIPS = [
  { label: 'Indie SaaS', url: 'https://smallseedlabs.co.uk', hook: 'Cut ops busywork by 80% with applied AI.' },
  { label: 'DTC Skincare', url: 'https://aesop.com', hook: 'Botanical barrier repair, backed by dermatologists.' },
  { label: 'AI Waitlist', url: 'https://linear.app', hook: 'The workspace built for high-velocity product teams.' },
] as const;

const VIBE_PREVIEWS = [
  { id: 'bold', label: '🔥 Bold', prefix: 'Stop wasting hours on manual workflows.' },
  { id: 'founder', label: '😎 Founder Story', prefix: 'We built this after hitting the exact same wall.' },
  { id: 'meme', label: '😂 Punchy', prefix: 'Your competitors already automated this. Just saying.' },
] as const;

export function MagicPromptCanvas({
  hasConnectedPlatform,
  userRole,
  goals = [],
  onConnectPlatform,
  onCreated,
}: {
  hasConnectedPlatform: boolean;
  userRole: string;
  goals?: GoalView[];
  onConnectPlatform?: (provider: 'meta' | 'reddit') => void;
  onCreated?: () => void;
}) {
  const { createGoal } = useWorkspace();
  const [urlInput, setUrlInput] = useState('');
  const [budget, setBudget] = useState<number>(25);
  const [customBudget, setCustomBudget] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [rail, setRail] = useState<'managed' | 'byo'>(hasConnectedPlatform ? 'byo' : 'managed');
  const [vibe, setVibe] = useState<'bold' | 'founder' | 'meme'>('bold');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 25 : budget;
  const activePreset = BUDGET_PILLS.find((p) => p.amount === effectiveBudget);
  const activeVibe = VIBE_PREVIEWS.find((v) => v.id === vibe) ?? VIBE_PREVIEWS[0];
  const matchedDemo = DEMO_CHIPS.find((d) => d.url === urlInput.trim());

  let previewHost = 'yourproduct.com';
  try {
    const candidate = urlInput.trim();
    if (candidate) {
      previewHost = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`).hostname.replace(/^www\./, '');
    }
  } catch {
    // keep fallback host
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseOptionalLandingPageUrl(urlInput);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    if (!parsed.url) {
      setError('Drop your product URL (e.g. https://yourproduct.com) to get started.');
      return;
    }
    if (effectiveBudget <= 0 || Number.isNaN(effectiveBudget)) {
      setError('Pick a valid daily budget above $0.');
      return;
    }
    let host = 'your product';
    try {
      host = new URL(parsed.url).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    setSubmitting(true);
    const ok = await createGoal({
      title: `Campaign for ${host}`,
      dailyBudget: effectiveBudget,
      currency: 'USD',
      landingPageUrl: parsed.url,
    });
    setSubmitting(false);
    if (ok) {
      setUrlInput('');
      onCreated?.();
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl py-4 lg:py-6">
      {/* Ambient Aurora */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/4 h-72 w-[520px] rounded-full bg-gradient-to-tr from-violet-600/20 via-indigo-500/15 to-fuchsia-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-[440px] rounded-full bg-gradient-to-tr from-emerald-500/15 via-cyan-500/10 to-violet-500/10 blur-3xl"
      />

      <div className="relative grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT STAGE: 1-Click Command Deck + Active Campaigns (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-white/10 bg-[#12121A]/95 p-6 shadow-2xl sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300">
                <Sparkles className="h-3 w-3" />
                Autonomous Ad Agent
              </div>
              <span className="font-mono text-[11px] text-emerald-400">● Ready in ~30s</span>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Drop your URL. We’ll handle the ads.
            </h1>
            <p className="mt-2 text-body text-slate-400">
              Proba scans your landing page, generates native Reddit &amp; Meta creatives, and optimizes spend 24/7.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <div className="relative flex-1">
                    <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="url"
                      inputMode="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://yourproduct.com"
                      className="w-full rounded-xl border border-white/15 bg-[#09090D] py-3 pl-10 pr-4 text-body text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 px-6 py-3 text-body font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:opacity-95 disabled:opacity-50"
                  >
                    <Zap className="h-4 w-4" />
                    {submitting ? 'Building…' : 'Generate Ads'}
                  </button>
                </div>
                {error && <p className="mt-2 text-caption text-rose-400">{error}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500">Quick try:</span>
                  {DEMO_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setUrlInput(chip.url)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:border-violet-400/50 hover:text-white"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hardware-inspired Budget Pills */}
              <div>
                <div className="flex items-center justify-between text-caption">
                  <span className="font-medium text-slate-300">Daily budget cap</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Max 7-day spend: ${effectiveBudget * 7}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BUDGET_PILLS.map((p) => {
                    const active = !isCustom && budget === p.amount;
                    return (
                      <button
                        key={p.amount}
                        type="button"
                        onClick={() => {
                          setIsCustom(false);
                          setBudget(p.amount);
                        }}
                        className={cn(
                          'rounded-xl border p-2.5 text-left transition',
                          active
                            ? 'border-violet-500 bg-violet-500/15 text-white shadow-sm'
                            : 'border-white/10 bg-[#09090D] text-slate-400 hover:border-white/25 hover:text-slate-200'
                        )}
                      >
                        <div className="font-mono text-body font-bold">{p.label}</div>
                        <div className="text-[11px] text-slate-400">{p.tag}</div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustom(true)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition',
                      isCustom
                        ? 'border-violet-500 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-[#09090D] text-slate-400 hover:border-white/25 hover:text-slate-200'
                    )}
                  >
                    <div className="font-mono text-body font-bold">Custom</div>
                    <div className="text-[11px] text-slate-400">Your cap</div>
                  </button>
                </div>
                {isCustom && (
                  <input
                    type="number"
                    min={1}
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    placeholder="Enter daily USD cap (e.g. 75)"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#09090D] px-3 py-2 font-mono text-body text-white"
                  />
                )}
              </div>

              {/* Account Rail Selector */}
              <div className="rounded-xl border border-white/10 bg-[#09090D]/80 p-3.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Run via</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRail('managed')}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-caption font-medium transition',
                      rail === 'managed'
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/10 text-slate-400 hover:text-white'
                    )}
                  >
                    ⚡ Proba Managed Account (No setup)
                  </button>
                  {userRole !== 'instant_managed' && (
                    <button
                      type="button"
                      onClick={() => setRail('byo')}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-caption font-medium transition',
                        rail === 'byo'
                          ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                          : 'border-white/10 text-slate-400 hover:text-white'
                      )}
                    >
                      🔗 My Meta / Reddit Account {hasConnectedPlatform ? '✓' : ''}
                    </button>
                  )}
                </div>
                {rail === 'byo' && !hasConnectedPlatform && onConnectPlatform && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5">
                    <span className="text-[11px] text-slate-400">1-click connect:</span>
                    <button
                      type="button"
                      onClick={() => onConnectPlatform('meta')}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                    >
                      Connect Meta
                    </button>
                    <button
                      type="button"
                      onClick={() => onConnectPlatform('reddit')}
                      className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                    >
                      Connect Reddit
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Active Campaigns Grid */}
          {goals.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#12121A]/80 p-5">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wide text-slate-400">
                  Your Campaigns ({goals.length})
                </span>
                <span className="text-[11px] text-slate-500">Click any to inspect or launch</span>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {goals.map((goal) => (
                  <a
                    key={goal.goalId}
                    href={routeHref({ section: 'goals', id: goal.goalId })}
                    className="group flex items-center justify-between rounded-xl border border-white/10 bg-[#09090D] p-3.5 transition hover:border-violet-500/50"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate text-body font-semibold text-white group-hover:text-violet-300">
                        {goal.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{formatRelativeTime(goal.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <GoalStatusBadge status={goal.status} />
                      <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-violet-300" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT STAGE: Interactive Live Ad Simulator & Guardrail Preview (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-white/10 bg-[#12121A]/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Live Ad Simulator
              </span>
              <div className="flex gap-1">
                {VIBE_PREVIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
                      vibe === v.id ? 'bg-violet-500/25 text-violet-200 border border-violet-500/40' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Native Ad Card */}
            <div className="mt-3 rounded-xl border border-white/10 bg-[#09090D] p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">{previewHost}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">Promoted</span>
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-gradient-to-br from-violet-950/60 via-[#12121A] to-indigo-950/60 p-4">
                <div className="text-[11px] font-medium text-violet-300">Auto-matched visual + hook</div>
                <div className="mt-1.5 text-body font-bold text-white">
                  {activeVibe.prefix}
                </div>
                <p className="mt-1 text-caption text-slate-300">
                  {matchedDemo
                    ? matchedDemo.hook
                    : `Discover how ${previewHost} helps teams get results faster without manual setup.`}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="truncate font-mono text-slate-400">{previewHost}</span>
                <span className="rounded-md bg-violet-600/25 px-2.5 py-1 font-semibold text-violet-200">
                  Learn More ↗
                </span>
              </div>
            </div>

            {/* Estimated Impact Strip */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-[#09090D] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  Est. Traffic
                </div>
                <div className="mt-1 font-mono text-caption font-bold text-white">
                  {activePreset ? activePreset.estClicks : `${Math.round(effectiveBudget * 2.5)}–${Math.round(effectiveBudget * 4.5)} clicks/day`}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#09090D] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                  Account Rail
                </div>
                <div className="mt-1 text-caption font-bold text-white">
                  {rail === 'managed' ? 'Proba Managed' : 'Your Ad Account'}
                </div>
              </div>
            </div>

            {/* 3-Step Autonomous Loop */}
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-caption">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>Scans your site &amp; extracts real product proof</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>Creates native Reddit &amp; Meta ad variants</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>Enforces ${effectiveBudget}/day cap &amp; pauses losers</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
