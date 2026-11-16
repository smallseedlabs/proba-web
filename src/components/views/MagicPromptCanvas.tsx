import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Bot, CheckCircle2, Globe, Search, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { runGoalGeoAudit, type GeoAuditResult, type GeoEngine } from '../../lib/geo/client';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatRelativeTime } from '../../lib/utils/format';
import type { GoalView } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';

const BUDGET_PILLS = [
  { amount: 10, label: '$10/day', tag: 'Test Waters', estClicks: '25–45 clicks/day', estCpc: '$0.38' },
  { amount: 25, label: '$25/day', tag: 'Sweet Spot', estClicks: '70–120 clicks/day', estCpc: '$0.31' },
  { amount: 50, label: '$50/day', tag: 'Scale Fast', estClicks: '150–260 clicks/day', estCpc: '$0.26' },
] as const;

const DEMO_CHIPS = [
  { label: 'Indie SaaS', url: 'https://smallseedlabs.co.uk', hook: 'Cut ops busywork by 80% with applied AI.' },
  { label: 'DTC Skincare', url: 'https://aesop.com', hook: 'Botanical barrier repair, backed by dermatologists.' },
  { label: 'AI Waitlist', url: 'https://linear.app', hook: 'The workspace built for high-velocity product teams.' },
] as const;

const ENGINE_LABELS: Record<GeoEngine, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

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
  const [previewTab, setPreviewTab] = useState<'ads' | 'geo'>('ads');
  const [geoAudit, setGeoAudit] = useState<GeoAuditResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 25 : budget;
  const activePreset = BUDGET_PILLS.find((p) => p.amount === effectiveBudget);
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
      setError('Enter your website URL (e.g. https://yourproduct.com) to generate ads.');
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

  async function handleRunGeoCheck() {
    setGeoError(null);
    const parsed = parseOptionalLandingPageUrl(urlInput || 'https://smallseedlabs.co.uk');
    const targetUrl = parsed.ok && parsed.url ? parsed.url : 'https://smallseedlabs.co.uk';
    let host = 'yourproduct.com';
    try {
      host = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    const brandName = host.split('.')[0] || 'YourBrand';
    setPreviewTab('geo');
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
      setGeoError((err as Error).message || 'Could not run AI visibility check');
    } finally {
      setGeoLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-2 lg:py-4">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT COLUMN: 1-Click Command Deck + What Proba Does + Active Campaigns (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F5F7FA] px-3 py-1 text-[11px] font-semibold text-[#0B0D12]">
                <span className="h-2 w-2 rounded-full bg-[#84CC16]" />
                1-Click Autonomous Growth Agent
              </span>
              <span className="font-mono text-[11px] text-slate-500">Ads + AI Search Visibility</span>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0B0D12] sm:text-3xl">
              Drop your URL. Launch ads &amp; boost AI visibility.
            </h1>
            <p className="mt-1.5 text-body text-slate-600">
              Proba scans your site, launches native Reddit &amp; Meta campaigns, and checks how often ChatGPT, Gemini, Claude &amp; Perplexity recommend your brand.
            </p>

            {/* Clear 3-pillar capability strip */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[#0B0D12]">
                  <Zap className="h-3.5 w-3.5 text-[#2563EB]" />
                  1-Click Paid Ads
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600">Auto-writes copy, picks visuals &amp; launches Reddit/Meta.</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[#0B0D12]">
                  <Bot className="h-3.5 w-3.5 text-[#2563EB]" />
                  LLM Brand Audit
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600">Measures your brand across ChatGPT, Gemini, Claude &amp; Perplexity.</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[#0B0D12]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#65A30D]" />
                  24/7 Guarded Cap
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600">Hard daily spend limit &amp; auto-pause on losers.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <div className="relative flex-1">
                    <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      inputMode="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://yourproduct.com"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white py-3 pl-10 pr-4 text-body text-[#0B0D12] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-body font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    <Zap className="h-4 w-4" />
                    {submitting ? 'Building…' : 'Generate Ads'}
                  </button>
                </div>
                {error && <p className="mt-2 text-caption text-red-600">{error}</p>}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Quick try:</span>
                    {DEMO_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setUrlInput(chip.url)}
                        className="rounded-full border border-[#E2E8F0] bg-[#F5F7FA] px-2.5 py-0.5 text-[11px] font-medium text-slate-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleRunGeoCheck}
                    disabled={geoLoading}
                    className="inline-flex items-center gap-1.5 text-caption font-semibold text-[#2563EB] hover:underline disabled:opacity-50"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {geoLoading ? 'Scanning LLMs…' : 'Check AI Brand Visibility →'}
                  </button>
                </div>
              </div>

              {/* Swiss Budget Pills */}
              <div>
                <div className="flex items-center justify-between text-caption">
                  <span className="font-semibold text-[#0B0D12]">Daily budget cap</span>
                  <span className="font-mono text-[11px] text-slate-500">
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
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#0B0D12] ring-1 ring-[#2563EB]'
                            : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-slate-300'
                        )}
                      >
                        <div className="font-mono text-body font-bold text-[#0B0D12]">{p.label}</div>
                        <div className="text-[11px] text-slate-500">{p.tag}</div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustom(true)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition',
                      isCustom
                        ? 'border-[#2563EB] bg-[#EFF6FF] text-[#0B0D12] ring-1 ring-[#2563EB]'
                        : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <div className="font-mono text-body font-bold text-[#0B0D12]">Custom</div>
                    <div className="text-[11px] text-slate-500">Your cap</div>
                  </button>
                </div>
                {isCustom && (
                  <input
                    type="number"
                    min={1}
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    placeholder="Enter daily USD cap (e.g. 75)"
                    className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-body text-[#0B0D12]"
                  />
                )}
              </div>

              {/* Account Rail Selector */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run via</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRail('managed')}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-caption font-semibold transition',
                      rail === 'managed'
                        ? 'border-[#2563EB] bg-white text-[#2563EB] shadow-sm'
                        : 'border-[#E2E8F0] bg-transparent text-slate-600 hover:text-[#0B0D12]'
                    )}
                  >
                    ⚡ Proba Managed Account (No setup)
                  </button>
                  {userRole !== 'instant_managed' && (
                    <button
                      type="button"
                      onClick={() => setRail('byo')}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-caption font-semibold transition',
                        rail === 'byo'
                          ? 'border-[#2563EB] bg-white text-[#2563EB] shadow-sm'
                          : 'border-[#E2E8F0] bg-transparent text-slate-600 hover:text-[#0B0D12]'
                      )}
                    >
                      🔗 My Meta / Reddit Account {hasConnectedPlatform ? '✓' : ''}
                    </button>
                  )}
                </div>
                {rail === 'byo' && !hasConnectedPlatform && onConnectPlatform && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-2.5">
                    <span className="text-[11px] text-slate-500">1-click connect:</span>
                    <button
                      type="button"
                      onClick={() => onConnectPlatform('meta')}
                      className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B0D12] hover:bg-slate-50"
                    >
                      Connect Meta
                    </button>
                    <button
                      type="button"
                      onClick={() => onConnectPlatform('reddit')}
                      className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B0D12] hover:bg-slate-50"
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
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wide text-slate-500">
                  Your Campaigns ({goals.length})
                </span>
                <span className="text-[11px] text-slate-400">Click any to launch or inspect</span>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {goals.map((goal) => (
                  <a
                    key={goal.goalId}
                    href={routeHref({ section: 'goals', id: goal.goalId })}
                    className="group flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3.5 transition hover:border-[#2563EB] hover:bg-white"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate text-body font-semibold text-[#0B0D12] group-hover:text-[#2563EB]">
                        {goal.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{formatRelativeTime(goal.updatedAt)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <GoalStatusBadge status={goal.status} />
                      <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[#2563EB]" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Tabbed Live Ad Simulator & AI Brand Visibility (GEO) (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            {/* Switcher between Ad Simulator & AI Brand Visibility */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F5F7FA] p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('ads')}
                  className={cn(
                    'rounded-md px-3 py-1 text-caption font-semibold transition',
                    previewTab === 'ads' ? 'bg-white text-[#0B0D12] shadow-sm' : 'text-slate-600 hover:text-[#0B0D12]'
                  )}
                >
                  Live Ad Simulator
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('geo')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-3 py-1 text-caption font-semibold transition',
                    previewTab === 'geo' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-600 hover:text-[#0B0D12]'
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  AI Brand Visibility
                </button>
              </div>
              <span className="h-2 w-2 rounded-full bg-[#84CC16]" title="Live" />
            </div>

            {previewTab === 'ads' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-[#0B0D12]">{previewHost}</span>
                    <span className="rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[10px]">Promoted</span>
                  </div>
                  <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-4">
                    <div className="text-[11px] font-semibold text-[#2563EB]">Auto-matched visual + hook</div>
                    <div className="mt-1 text-body font-bold text-[#0B0D12]">
                      {matchedDemo ? matchedDemo.hook : `Built for teams using ${previewHost}`}
                    </div>
                    <p className="mt-1 text-caption text-slate-600">
                      Skip manual setup. Proba generates native creatives and targets high-intent buyers automatically.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="truncate font-mono text-slate-500">{previewHost}</span>
                    <span className="rounded-md bg-[#2563EB] px-2.5 py-1 font-semibold text-white">
                      Learn More ↗
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <TrendingUp className="h-3.5 w-3.5 text-[#65A30D]" />
                      Est. Traffic
                    </div>
                    <div className="mt-1 font-mono text-caption font-bold text-[#0B0D12]">
                      {activePreset ? activePreset.estClicks : `${Math.round(effectiveBudget * 2.5)}–${Math.round(effectiveBudget * 4.5)} clicks/day`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                      Est. CPC / Rail
                    </div>
                    <div className="mt-1 font-mono text-caption font-bold text-[#0B0D12]">
                      {activePreset ? activePreset.estCpc : '$0.30'} · {rail === 'managed' ? 'Managed' : 'BYO'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#E2E8F0] pt-3 text-caption text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#65A30D]" />
                    <span>Scans your site &amp; extracts real product proof</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#65A30D]" />
                    <span>Creates native Reddit &amp; Meta ad variants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#65A30D]" />
                    <span>Enforces ${effectiveBudget}/day cap &amp; pauses losers</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body font-bold text-[#0B0D12]">LLM Brand Visibility (GEO)</div>
                    <p className="text-[11px] text-slate-500">
                      See how often AI engines recommend <strong className="text-[#0B0D12]">{previewHost}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunGeoCheck}
                    disabled={geoLoading}
                    className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-caption font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    {geoLoading ? 'Scanning…' : geoAudit ? 'Re-scan' : 'Run Audit'}
                  </button>
                </div>

                {geoError && <p className="text-caption text-red-600">{geoError}</p>}

                {geoAudit ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-3">
                      <span className="text-caption font-semibold text-[#0B0D12]">Overall AI Visibility</span>
                      <span className="font-mono text-xl font-bold text-[#2563EB]">{geoAudit.visibilityScore}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(ENGINE_LABELS) as GeoEngine[]).map((eng) => {
                        const s = geoAudit.engineScores[eng];
                        return (
                          <div key={eng} className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                            <div className="flex items-center justify-between text-caption">
                              <span className="font-semibold text-[#0B0D12]">{ENGINE_LABELS[eng]}</span>
                              <span className="font-mono font-bold text-[#2563EB]">{s.score}%</span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {s.mode === 'api' ? 'Live API' : 'Web Search'} · {s.mentions}/{s.total}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {geoAudit.decisionProposals[0] && (
                      <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-[11px] text-[#0B0D12]">
                        <div className="font-semibold text-[#2563EB]">Next Recommended Action</div>
                        <p className="mt-0.5 text-slate-700">{geoAudit.decisionProposals[0].title}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] p-4 text-caption text-slate-600">
                    <p className="font-semibold text-[#0B0D12]">What the AI Visibility Audit checks:</p>
                    <ul className="space-y-1.5 text-[12px]">
                      <li>• Brand mention rate across ChatGPT, Gemini, Claude &amp; Perplexity</li>
                      <li>• Which Reddit threads &amp; review sites AI engines cite instead of you</li>
                      <li>• Generates <code className="font-mono text-[#2563EB]">/llms.txt</code>, FAQ JSON-LD &amp; Reddit campaign plans</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
