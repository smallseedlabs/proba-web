import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { runGoalGeoAudit, type GeoAuditResult, type GeoEngine } from '../../lib/geo/client';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatRelativeTime } from '../../lib/utils/format';
import type { GoalView } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';

const BUDGET_OPTIONS = [
  { amount: 10, tag: 'Starter', desc: '~25–45 visitors/day' },
  { amount: 25, tag: 'Recommended', desc: '~70–120 visitors/day' },
  { amount: 50, tag: 'Growth', desc: '~150–260 visitors/day' },
] as const;

const SAMPLE_BRANDS = [
  { label: 'Small Seed Labs', url: 'https://smallseedlabs.co.uk', hook: 'Save hours every week with AI workflows built for busy teams.' },
  { label: 'Aesop Skincare', url: 'https://aesop.com', hook: 'Botanical skincare crafted for calm, healthy skin.' },
  { label: 'Linear App', url: 'https://linear.app', hook: 'Plan, build, and ship products without the busywork.' },
] as const;

const ENGINE_LABELS: Record<GeoEngine, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

export function MagicPromptCanvas({
  hasConnectedPlatform,
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
  onConnectPlatform?: (provider: 'meta' | 'reddit') => void;
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
    userRole === 'instant_managed' ? 'managed' : hasConnectedPlatform ? 'byo' : 'managed'
  );
  const [rightTab, setRightTab] = useState<'ad' | 'ai'>('ad');
  const [geoAudit, setGeoAudit] = useState<GeoAuditResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 0 : budget;
  const matchedSample = SAMPLE_BRANDS.find((d) => d.url === urlInput.trim());

  let previewHost = 'yourwebsite.com';
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
      setError('Please enter your website link (for example: yourbusiness.com).');
      return;
    }
    if (isCustom && (!customBudget.trim() || effectiveBudget <= 0 || Number.isNaN(effectiveBudget))) {
      setError('Please enter a daily budget above 0.');
      return;
    }
    if (effectiveBudget <= 0 || Number.isNaN(effectiveBudget)) {
      setError('Please pick a daily budget.');
      return;
    }
    let host = 'your website';
    try {
      host = new URL(parsed.url).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    onBeforeCreate?.();
    setSubmitting(true);
    const ok = await createGoal({
      title: `Campaign for ${host}`,
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
    let host = 'yourwebsite.com';
    try {
      host = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    const brandName = host.split('.')[0] || 'YourBrand';
    setRightTab('ai');
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
      setGeoError((err as Error).message || 'Could not check AI visibility right now.');
    } finally {
      setGeoLoading(false);
    }
  }

  const metaStatus = platformConnections?.meta;
  const redditStatus = platformConnections?.reddit;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column (7 cols): Friendly Guided Launch Studio + Recent Campaigns */}
        <div className="space-y-6 lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-caption font-semibold text-[#2563EB]">
              <Sparkles className="h-3.5 w-3.5" />
              Automatic Ad &amp; AI Growth
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
              Turn your website into live ads in one click.
            </h1>
            <p className="mt-2 text-body text-slate-600">
              Paste your website link below. Proba writes your ads, finds matching visuals, and runs campaigns on Meta &amp; Reddit within your daily limit.
            </p>

            {/* URL Input + Primary CTA */}
            <div className="mt-6">
              <label htmlFor="proba-url-input" className="sr-only">
                Your website link
              </label>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative flex-1">
                  <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="proba-url-input"
                    type="text"
                    inputMode="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Enter your website (e.g. yourbrand.com)"
                    className="h-12 w-full rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] pl-11 pr-4 text-body text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-body font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  {submitting ? 'Creating Ads…' : 'Create My Ads'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              {error && <p className="mt-2 text-caption font-medium text-red-600">{error}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
                <span className="text-slate-500">Examples:</span>
                {SAMPLE_BRANDS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setUrlInput(sample.url)}
                    className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[12px] font-medium text-slate-700 transition hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Friendly Daily Budget Picker */}
            <div className="mt-7 border-t border-[#F1F5F9] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-body font-semibold text-[#0F172A]">Daily budget limit</span>
                  <span className="ml-2 text-caption text-slate-500">You can pause or cancel anytime</span>
                </div>
                <select
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-caption font-semibold text-[#0F172A]"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {BUDGET_OPTIONS.map((opt) => {
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
                        'rounded-2xl border p-3.5 text-left transition',
                        active
                          ? 'border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]'
                          : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                      )}
                    >
                      <div className="text-[11px] font-semibold text-[#2563EB]">{opt.tag}</div>
                      <div className="mt-0.5 text-lg font-bold text-[#0F172A]">
                        {formatCurrency(opt.amount, currency)}
                        <span className="text-caption font-normal text-slate-500">/day</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{opt.desc}</div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition',
                    isCustom
                      ? 'border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]'
                      : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                  )}
                >
                  <div className="text-[11px] font-semibold text-slate-500">Flexible</div>
                  <div className="mt-0.5 text-lg font-bold text-[#0F172A]">Custom</div>
                  <div className="mt-1 text-[11px] text-slate-500">Set your own cap</div>
                </button>
              </div>

              {isCustom && (
                <div className="mt-3">
                  <input
                    type="number"
                    min={1}
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    placeholder={`Enter daily limit in ${currency} (e.g. 75)`}
                    className="h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-body text-[#0F172A]"
                  />
                </div>
              )}
            </div>

            {/* Account Choice (Only shown when user can use own ad accounts) */}
            {userRole !== 'instant_managed' && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                <div className="flex items-center gap-2 text-caption">
                  <span className="font-semibold text-[#0F172A]">Run ads using:</span>
                  <button
                    type="button"
                    onClick={() => setRail('managed')}
                    className={cn(
                      'rounded-lg px-3 py-1 font-medium transition',
                      rail === 'managed' ? 'bg-white text-[#2563EB] shadow-sm font-semibold' : 'text-slate-600'
                    )}
                  >
                    Proba Managed
                  </button>
                  <button
                    type="button"
                    onClick={() => setRail('byo')}
                    className={cn(
                      'rounded-lg px-3 py-1 font-medium transition',
                      rail === 'byo' ? 'bg-white text-[#2563EB] shadow-sm font-semibold' : 'text-slate-600'
                    )}
                  >
                    My Ad Accounts
                  </button>
                </div>

                {rail === 'byo' && (
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    {metaStatus === 'connected' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Meta ready
                      </span>
                    ) : onConnectPlatform ? (
                      <button
                        type="button"
                        onClick={() => onConnectPlatform('meta')}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        <Link2 className="h-3 w-3" />
                        {metaStatus === 'needs_reconnect' ? 'Reconnect Meta' : 'Connect Meta'}
                      </button>
                    ) : null}

                    {redditStatus === 'connected' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reddit ready
                      </span>
                    ) : onConnectPlatform ? (
                      <button
                        type="button"
                        onClick={() => onConnectPlatform('reddit')}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-semibold text-[#0F172A] hover:bg-slate-50"
                      >
                        <Link2 className="h-3 w-3" /> Connect Reddit
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Never spends above {formatCurrency(effectiveBudget || 25, currency)}/day
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Review before going live
              </span>
            </div>
          </form>

          {/* Recent Campaigns */}
          {goals.length > 0 && (
            <section className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-body font-bold text-[#0F172A]">Your Campaigns</h2>
                <span className="text-caption text-slate-500">{goals.length} total</span>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {goals.slice(0, 6).map((goal) => (
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
            </section>
          )}
        </div>

        {/* Right Column (5 cols): Visual Preview & Free AI Brand Check */}
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm lg:col-span-5">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#F1F5F9] p-1">
            <button
              type="button"
              onClick={() => setRightTab('ad')}
              className={cn(
                'flex-1 rounded-xl py-2 text-caption font-semibold transition',
                rightTab === 'ad' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-600 hover:text-[#0F172A]'
              )}
            >
              Sample Ad Preview
            </button>
            <button
              type="button"
              onClick={() => setRightTab('ai')}
              className={cn(
                'flex-1 rounded-xl py-2 text-caption font-semibold transition',
                rightTab === 'ai' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-600 hover:text-[#0F172A]'
              )}
            >
              AI Search Check
            </button>
          </div>

          {rightTab === 'ad' ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-body font-bold text-white">
                      {previewHost.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-body font-semibold text-[#0F172A]">{previewHost}</div>
                      <div className="text-[11px] text-slate-500">Sponsored · Meta &amp; Reddit</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-[#E2E8F0]">
                    {formatCurrency(effectiveBudget || 25, currency)}/day
                  </span>
                </div>

                {/* Warm Visual Banner instead of dashed box */}
                <div className="mt-3.5 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                  <div className="relative flex h-44 flex-col justify-end bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#38BDF8] p-5 text-white">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100">
                      Featured Offer
                    </div>
                    <div className="mt-1 text-lg font-bold leading-snug">
                      {matchedSample ? matchedSample.hook : `Discover how ${previewHost} helps customers save time`}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate text-caption font-semibold text-[#0F172A]">{previewHost}</div>
                      <div className="text-[12px] text-slate-500">Tailored copy &amp; visuals from your site</div>
                    </div>
                    <span className="shrink-0 rounded-xl bg-[#0F172A] px-3.5 py-2 text-caption font-semibold text-white">
                      Learn More
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-caption">
                <div className="font-semibold text-[#0F172A]">What Proba handles automatically</div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Reads your website to write natural, accurate ads</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Finds real visuals &amp; launches on Meta and Reddit</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Protects your budget with automatic pause rules</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <h3 className="text-body font-bold text-[#0F172A]">How often do AI assistants recommend you?</h3>
                <p className="mt-1 text-caption text-slate-600">
                  Check whether ChatGPT, Gemini, Claude, and Perplexity mention <span className="font-semibold text-[#0F172A]">{previewHost}</span> when customers ask for recommendations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunGeoCheck}
                disabled={geoLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-4 py-3 text-body font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {geoLoading ? 'Checking AI Assistants…' : geoAudit ? 'Run Fresh Check' : 'Check My AI Visibility'}
              </button>

              {geoError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-caption text-red-700">
                  {geoError}
                </div>
              )}

              {geoAudit ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <div>
                      <div className="text-caption text-slate-500">Overall AI Visibility</div>
                      <div className="text-3xl font-bold text-[#0F172A]">{geoAudit.visibilityScore}%</div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-caption font-semibold text-slate-700 border border-[#E2E8F0]">
                      {previewHost}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(Object.keys(ENGINE_LABELS) as GeoEngine[]).map((eng) => {
                      const stats = geoAudit.engineScores[eng];
                      const score = stats?.score ?? 0;
                      const mentioned = (stats?.mentions ?? 0) > 0;
                      return (
                        <div key={eng} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                          <div className="flex items-center justify-between text-caption">
                            <span className="font-semibold text-[#0F172A]">{ENGINE_LABELS[eng]}</span>
                            <span className="font-bold text-slate-700">{score}%</span>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
                <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  {(['chatgpt', 'gemini', 'claude', 'perplexity'] as const).map((engine) => (
                    <div key={engine} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-caption border border-[#E2E8F0]">
                      <span className="font-semibold text-[#0F172A]">{ENGINE_LABELS[engine]}</span>
                      <span className="text-slate-400">Ready to check</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
