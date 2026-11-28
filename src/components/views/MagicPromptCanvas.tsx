import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { runGoalGeoAudit, type GeoAuditResult, type GeoEngine } from '../../lib/geo/client';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatRelativeTime } from '../../lib/utils/format';
import type { GoalView } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';

const BUDGET_PRESETS = [
  { amount: 10, label: 'Starter' },
  { amount: 25, label: 'Recommended' },
  { amount: 50, label: 'Scale' },
] as const;

const SAMPLE_BRANDS = [
  {
    label: 'Small Seed Labs',
    url: 'https://smallseedlabs.co.uk',
    hook: 'AI workflows that give modern teams back their week.',
    prompt: 'Best applied AI tools for enterprise ops?',
    score: 94,
    photo: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Aesop Skincare',
    url: 'https://aesop.com',
    hook: 'Formulations for skin, hair, and body—crafted with botanical precision.',
    prompt: 'Top minimalist botanical skincare brands?',
    score: 91,
    photo: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Linear App',
    url: 'https://linear.app',
    hook: 'Purpose-built for modern product teams shipping at high velocity.',
    prompt: 'Best issue tracker for fast-moving software teams?',
    score: 96,
    photo: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
  },
] as const;

const ENGINE_LABELS: Record<GeoEngine, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

export function MagicPromptCanvas({
  hasConnectedPlatform: _hasConnectedPlatform,
  platformConnections,
  defaultCurrency = 'GBP',
  userRole,
  goals = [],
  onConnectPlatform,
  onBeforeCreate,
  onCreated,
}: {
  hasConnectedPlatform: boolean;
  platformConnections?: { meta?: string; reddit?: string };
  defaultCurrency?: string;
  userRole: string;
  goals?: GoalView[];
  onConnectPlatform?: (provider: 'meta' | 'reddit') => Promise<void> | void;
  onBeforeCreate?: () => void;
  onCreated?: () => void;
}) {
  const { createGoal } = useWorkspace();
  const [urlInput, setUrlInput] = useState('');
  const [budget, setBudget] = useState<number>(25);
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [customBudget, setCustomBudget] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [rail, setRail] = useState<'managed' | 'byo'>(
    userRole === 'instant_managed' ? 'managed' : 'byo'
  );
  const [previewChannel, setPreviewChannel] = useState<'meta' | 'reddit'>('meta');
  const [showArchived, setShowArchived] = useState(false);
  const [geoAudit, setGeoAudit] = useState<GeoAuditResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 0 : budget;
  const matchedSample = SAMPLE_BRANDS.find((d) => d.url === urlInput.trim()) ?? SAMPLE_BRANDS[0];
  const hasTypedUrl = urlInput.trim().length > 0;

  let previewHost = 'yourbrand.com';
  try {
    const candidate = urlInput.trim();
    if (candidate) {
      previewHost = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`).hostname.replace(/^www\./, '');
    }
  } catch {
    // keep fallback host
  }

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused' || g.status === 'completed');
  const archivedGoals = goals.filter((g) => g.status === 'cancelled');

  async function handleConnect(provider: 'meta' | 'reddit') {
    if (!onConnectPlatform) return;
    setError(null);
    try {
      await onConnectPlatform(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not connect ${provider}.`);
    }
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
      setError('Enter your brand domain to begin (for example: yourbrand.com).');
      return;
    }
    if (isCustom && (!customBudget.trim() || effectiveBudget <= 0 || Number.isNaN(effectiveBudget))) {
      setError('Enter a daily investment cap greater than 0.');
      return;
    }
    if (effectiveBudget <= 0 || Number.isNaN(effectiveBudget)) {
      setError('Select a daily investment cap.');
      return;
    }
    let host = 'your brand';
    try {
      host = new URL(parsed.url).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    onBeforeCreate?.();
    setSubmitting(true);
    const ok = await createGoal({
      title: `Brand Growth — ${host}`,
      dailyBudget: effectiveBudget,
      currency,
      landingPageUrl: parsed.url,
    });
    if (ok) {
      setUrlInput('');
      onCreated?.();
    } else {
      setSubmitting(false);
    }
  }

  async function handleRunGeoCheck() {
    setGeoError(null);
    const effectiveInput = urlInput.trim() || 'https://smallseedlabs.co.uk';
    if (!urlInput.trim()) setUrlInput(effectiveInput);
    const parsed = parseOptionalLandingPageUrl(effectiveInput);
    const targetUrl = parsed.ok && parsed.url ? parsed.url : 'https://smallseedlabs.co.uk';
    let host = 'yourbrand.com';
    try {
      host = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    const brandName = host.split('.')[0] || 'YourBrand';
    setGeoLoading(true);
    try {
      const res = await runGoalGeoAudit({
        workspaceId: 'seedbed',
        goalId: `preview-${host}`,
        brandName,
        domain: targetUrl,
        competitors: [],
        prompts: [
          `best ${brandName} alternatives`,
          `what is ${brandName} and is it worth it`,
        ],
      });
      setGeoAudit(res);
    } catch (err) {
      setGeoError((err as Error).message || 'Could not audit AI visibility right now.');
    } finally {
      setGeoLoading(false);
    }
  }

  const metaStatus = platformConnections?.meta;
  const redditStatus = platformConnections?.reddit;
  const mentionedEngines = geoAudit
    ? (Object.keys(ENGINE_LABELS) as GeoEngine[]).filter((e) => (geoAudit.engineScores[e]?.mentions ?? 0) > 0).length
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 pb-8">
      {/* Lovable-inspired Atmospheric Centered Command Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white px-6 py-10 shadow-sm sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-64 opacity-70 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 25% 20%, rgba(37, 99, 235, 0.14), transparent 50%), radial-gradient(circle at 75% 15%, rgba(16, 185, 129, 0.12), transparent 45%)',
          }}
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF]/80 px-3.5 py-1 text-caption font-semibold text-[#2563EB]">
            <Sparkles className="h-3.5 w-3.5" />
            Autonomous Brand Growth Studio
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Grow your brand across social and AI search.
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-body text-slate-600">
            Enter your brand domain once. Proba creates native Meta &amp; Reddit campaigns, protects your daily cap, and measures how ChatGPT, Gemini &amp; Perplexity recommend you.
          </p>

          {/* Single Floating Command Bar */}
          <form onSubmit={handleSubmit} className="mt-7">
            <div className="flex flex-col gap-2 rounded-2xl border border-[#CBD5E1] bg-white p-2 shadow-lg shadow-slate-200/60 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-[#2563EB]/10 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="proba-url-input"
                  type="text"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter your brand domain (e.g. smallseedlabs.co.uk)"
                  className="h-11 w-full rounded-xl bg-transparent pl-10 pr-3 text-body text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              {/* Compact Segmented Budget Pill Inside Command Bar */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 sm:justify-start">
                <select
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-2 text-caption font-semibold text-[#0F172A]"
                >
                  <option value="GBP">£ GBP</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
                {BUDGET_PRESETS.map((opt) => {
                  const active = !isCustom && budget === opt.amount;
                  return (
                    <button
                      key={opt.amount}
                      type="button"
                      onClick={() => {
                        setIsCustom(false);
                        setBudget(opt.amount);
                      }}
                      className={cn(
                        'h-9 rounded-lg px-3 text-caption font-semibold transition',
                        active
                          ? 'bg-[#0F172A] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white hover:text-[#0F172A]'
                      )}
                    >
                      {formatCurrency(opt.amount, currency)}/d
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={cn(
                    'h-9 rounded-lg px-2.5 text-caption font-semibold transition',
                    isCustom
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-[#0F172A]'
                  )}
                >
                  Custom
                </button>
                {isCustom && (
                  <input
                    type="number"
                    min={1}
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    placeholder="75"
                    className="h-9 w-16 rounded-lg border border-[#CBD5E1] bg-white px-2 text-caption text-[#0F172A]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 text-body font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {submitting ? 'Building Growth Plan…' : 'Grow My Brand'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {error && <p className="mt-2.5 text-caption font-medium text-red-600">{error}</p>}

            {/* Sub-bar: Sample Brands + Execution Rail + Guardrail Trust */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-caption">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Try a brand:</span>
                {SAMPLE_BRANDS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setUrlInput(sample.url)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12px] font-medium transition',
                      urlInput.trim() === sample.url
                        ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]'
                    )}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                <div className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] p-0.5">
                  <button
                    type="button"
                    onClick={() => setRail('managed')}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition',
                      rail === 'managed' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-500'
                    )}
                  >
                    Proba Managed
                  </button>
                  <button
                    type="button"
                    onClick={() => setRail('byo')}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition',
                      rail === 'byo' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-500'
                    )}
                  >
                    Your Accounts
                  </button>
                </div>

                {rail === 'managed' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                    Using Proba Managed Account
                    {onConnectPlatform && (
                      <button
                        type="button"
                        onClick={() => setRail('byo')}
                        className="underline decoration-[#2563EB]/50 underline-offset-2 hover:text-[#1E40AF]"
                      >
                        Connect yours
                      </button>
                    )}
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {metaStatus === 'connected' ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Meta (FB & IG)
                        </span>
                        {onConnectPlatform && (
                          <button
                            type="button"
                            onClick={() => void handleConnect('meta')}
                            className="px-1 py-0.5 text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-[#2563EB]"
                          >
                            Reconnect
                          </button>
                        )}
                      </>
                    ) : onConnectPlatform ? (
                      <button
                        type="button"
                        onClick={() => void handleConnect('meta')}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                      >
                        <Link2 className="h-3 w-3" /> {metaStatus === 'needs_reconnect' ? 'Reconnect Meta (FB & IG)' : 'Connect Meta (FB & IG)'}
                      </button>
                    ) : null}
                    {redditStatus === 'connected' ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Reddit
                        </span>
                        {onConnectPlatform && (
                          <button
                            type="button"
                            onClick={() => void handleConnect('reddit')}
                            className="text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-[#2563EB]"
                          >
                            Reconnect
                          </button>
                        )}
                      </>
                    ) : onConnectPlatform ? (
                      <button
                        type="button"
                        onClick={() => void handleConnect('reddit')}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A]"
                      >
                        <Link2 className="h-3 w-3" /> Connect Reddit
                      </button>
                    ) : null}
                  </div>
                )}

                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Hard cap {formatCurrency(effectiveBudget || 25, currency)}/day
                </span>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Omneky × Profound Inspired 2-Column Live Growth Showcase */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Showcase (6 cols): Omneky-style Creative Preview with Real Photo & Hook Score */}
        <section className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-body font-bold text-[#0F172A]">Social Creative Studio</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <TrendingUp className="h-3 w-3" />
                  Hook Score {matchedSample.score}/100
                </span>
              </div>
              <div className="flex items-center rounded-xl bg-[#F1F5F9] p-1 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewChannel('meta')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 transition',
                    previewChannel === 'meta' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500'
                  )}
                >
                  Meta Feed
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewChannel('reddit')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 transition',
                    previewChannel === 'reddit' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500'
                  )}
                >
                  Reddit
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-caption font-bold text-white">
                    {(hasTypedUrl ? previewHost : matchedSample.label).slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-caption font-semibold text-[#0F172A]">
                      {hasTypedUrl ? previewHost : matchedSample.label}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {previewChannel === 'meta' ? 'Sponsored · Meta Feed & Reels' : 'Promoted · Reddit Communities'}
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                  {formatCurrency(effectiveBudget || 25, currency)}/d
                </span>
              </div>

              <div className="relative h-52 w-full overflow-hidden bg-slate-900">
                <img
                  src={matchedSample.photo}
                  alt={hasTypedUrl ? previewHost : matchedSample.label}
                  className="h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                    {previewChannel === 'meta' ? 'Meta Visual Ad' : 'Reddit Native Post'}
                  </span>
                  <div className="mt-1.5 text-lg font-bold leading-snug">
                    {hasTypedUrl && urlInput.trim() !== matchedSample.url
                      ? `Position ${previewHost} in front of high-intent buyers`
                      : matchedSample.hook}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-caption font-semibold text-[#0F172A]">
                    {hasTypedUrl ? previewHost : matchedSample.url.replace(/^https?:\/\//, '')}
                  </div>
                  <div className="text-[11px] text-slate-500">Auto-matched creative, targeting &amp; spend cap</div>
                </div>
                <span className="shrink-0 rounded-xl bg-[#0F172A] px-3.5 py-1.5 text-[12px] font-semibold text-white">
                  Explore Brand
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Showcase (6 cols): Profound / Peec AI Style Answer Engine Visibility */}
        <section className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#2563EB]">
                  <Bot className="h-3.5 w-3.5" />
                  AI Answer Engine Visibility (GEO)
                </div>
                <h2 className="mt-1 text-body font-bold text-[#0F172A]">
                  How ChatGPT, Gemini &amp; Perplexity recommend your brand
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRunGeoCheck}
                disabled={geoLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-caption font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" />
                {geoLoading ? 'Auditing…' : geoAudit ? 'Refresh Audit' : 'Audit AI Visibility'}
              </button>
            </div>

            {/* Simulated Buyer Prompt Row (Profound pattern) */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Sample Buyer Prompt Tested
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-body font-medium text-[#0F172A]">
                <span className="truncate">
                  &ldquo;{hasTypedUrl ? `What are the best alternatives to ${previewHost}?` : matchedSample.prompt}&rdquo;
                </span>
                <span className="shrink-0 rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  {geoAudit ? `${mentionedEngines}/4 engines` : '4 engines'}
                </span>
              </div>
            </div>

            {geoError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-caption text-red-700">
                {geoError}
              </div>
            )}

            {geoAudit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <div>
                    <div className="text-[11px] text-slate-500">Brand AI Visibility Score</div>
                    <div className="text-3xl font-bold text-[#0F172A]">{geoAudit.visibilityScore}%</div>
                  </div>
                  <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-caption font-semibold text-slate-700">
                    {previewHost}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(ENGINE_LABELS) as GeoEngine[]).map((eng) => {
                    const stats = geoAudit.engineScores[eng];
                    const score = stats?.score ?? 0;
                    const mentioned = (stats?.mentions ?? 0) > 0;
                    return (
                      <div key={eng} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                        <div className="flex items-center justify-between text-caption">
                          <span className="font-semibold text-[#0F172A]">{ENGINE_LABELS[eng]}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', mentioned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                            {mentioned ? 'Cited' : 'Missing'} · {score}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={cn('h-full rounded-full', mentioned ? 'bg-emerald-500' : 'bg-amber-400')}
                            style={{ width: `${Math.max(8, score)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {(['chatgpt', 'gemini', 'claude', 'perplexity'] as const).map((engine) => (
                  <div key={engine} className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-caption">
                    <span className="font-semibold text-[#0F172A]">{ENGINE_LABELS[engine]}</span>
                    <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                      Ready
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3 text-[12px] text-slate-500">
            <span>Tracks brand mentions, competitor share &amp; AI citations</span>
            <span className="font-semibold text-[#0F172A]">Includes fix recommendations</span>
          </div>
        </section>
      </div>

      {/* Brand Initiatives (Active + Collapsible History) */}
      {goals.length > 0 && (
        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-body font-bold text-[#0F172A]">Brand Initiatives</h2>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {activeGoals.length > 0 ? `${activeGoals.length} active` : `${archivedGoals.length} archived`}
              </span>
            </div>
            {archivedGoals.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="inline-flex items-center gap-1 text-caption font-semibold text-[#2563EB] hover:underline"
              >
                {showArchived ? 'Hide past runs' : `View ${archivedGoals.length} past runs`}
                {showArchived ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {activeGoals.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => (
                <a
                  key={goal.goalId}
                  href={routeHref({ section: 'goals', id: goal.goalId })}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 transition hover:border-[#2563EB] hover:bg-white"
                >
                  <div className="min-w-0">
                    <div className="truncate text-body font-semibold text-[#0F172A] group-hover:text-[#2563EB]">
                      {goal.title}
                    </div>
                    <div className="mt-0.5 text-[12px] text-slate-500">
                      {goal.metrics?.budget ? `${formatCurrency(goal.metrics.budget, goal.metrics.currency ?? currency)}/day · ` : ''}
                      {formatRelativeTime(goal.updatedAt)}
                    </div>
                  </div>
                  <GoalStatusBadge status={goal.status} />
                </a>
              ))}
            </div>
          )}

          {showArchived && archivedGoals.length > 0 && (
            <div className={cn('grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3', activeGoals.length > 0 ? 'mt-4 border-t border-[#F1F5F9] pt-4' : 'mt-4')}>
              {archivedGoals.map((goal) => (
                <a
                  key={goal.goalId}
                  href={routeHref({ section: 'goals', id: goal.goalId })}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-caption transition hover:border-[#2563EB] hover:bg-white"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#0F172A] group-hover:text-[#2563EB]">
                      {goal.title}
                    </div>
                    <div className="text-[11px] text-slate-400">{formatRelativeTime(goal.updatedAt)}</div>
                  </div>
                  <GoalStatusBadge status={goal.status} />
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
