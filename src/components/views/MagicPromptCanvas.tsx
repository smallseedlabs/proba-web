import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Bot,
  Globe,
  Layers,
  Link2,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { runGoalGeoAudit, type GeoAuditResult, type GeoEngine } from '../../lib/geo/client';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { routeHref } from '../../lib/router';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatRelativeTime } from '../../lib/utils/format';
import type { GoalView } from '../../state/selectors';
import { useWorkspace } from '../../state/workspace';
import { GoalStatusBadge } from '../registry/cards';

const BUDGET_PRESETS = [10, 25, 50] as const;

const DEMO_CHIPS = [
  { label: 'smallseedlabs.co.uk', url: 'https://smallseedlabs.co.uk', hook: 'Cut ops busywork by 80% with applied AI.' },
  { label: 'aesop.com', url: 'https://aesop.com', hook: 'Botanical barrier repair, backed by dermatologists.' },
  { label: 'linear.app', url: 'https://linear.app', hook: 'The workspace built for high-velocity product teams.' },
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
  const [geoAudit, setGeoAudit] = useState<GeoAuditResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 0 : budget;
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
      setError('Enter a website URL (e.g. https://yourproduct.com) to launch.');
      return;
    }
    if (isCustom && (!customBudget.trim() || effectiveBudget <= 0 || Number.isNaN(effectiveBudget))) {
      setError('Enter a valid custom daily budget above 0.');
      return;
    }
    if (effectiveBudget <= 0 || Number.isNaN(effectiveBudget)) {
      setError('Pick a valid daily budget above 0.');
      return;
    }
    let host = 'your product';
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
    let host = 'yourproduct.com';
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
      setGeoError((err as Error).message || 'Could not run AI visibility check');
    } finally {
      setGeoLoading(false);
    }
  }

  const metaStatus = platformConnections?.meta;
  const redditStatus = platformConnections?.reddit;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* Option 2: Edge-to-Edge Command Strip */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {/* URL Input */}
          <div className="relative min-w-0 flex-1">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              inputMode="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter website URL (e.g. smallseedlabs.co.uk)"
              className="h-11 w-full rounded-xl border border-[#CBD5E1] bg-[#FAFAFA] pl-10 pr-4 text-body text-[#09090B] placeholder:text-slate-400 focus:border-[#18181B] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Budget Cap Strip */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-1">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-9 rounded-lg bg-white px-2 font-mono text-caption font-semibold text-[#09090B] border border-[#E5E7EB]"
            >
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            {BUDGET_PRESETS.map((amt) => {
              const active = !isCustom && budget === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    setBudget(amt);
                  }}
                  className={cn(
                    'h-9 rounded-lg px-3 font-mono text-caption font-semibold transition',
                    active ? 'bg-[#18181B] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#09090B]'
                  )}
                >
                  {formatCurrency(amt, currency)}/d
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={cn(
                'h-9 rounded-lg px-3 text-caption font-semibold transition',
                isCustom ? 'bg-[#18181B] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#09090B]'
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
                className="h-9 w-20 rounded-lg border border-[#CBD5E1] bg-white px-2.5 font-mono text-caption text-[#09090B]"
              />
            )}
          </div>

          {/* Account Rail & Platform Health */}
          <div className="flex flex-wrap items-center gap-2">
            {userRole !== 'instant_managed' && (
              <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-1 text-caption font-medium">
                <button
                  type="button"
                  onClick={() => setRail('managed')}
                  className={cn(
                    'h-9 rounded-lg px-2.5 transition',
                    rail === 'managed' ? 'bg-white text-[#09090B] shadow-sm font-semibold' : 'text-slate-500'
                  )}
                >
                  Managed
                </button>
                <button
                  type="button"
                  onClick={() => setRail('byo')}
                  className={cn(
                    'h-9 rounded-lg px-2.5 transition',
                    rail === 'byo' ? 'bg-white text-[#09090B] shadow-sm font-semibold' : 'text-slate-500'
                  )}
                >
                  My Accounts
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#18181B] px-5 text-body font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
            >
              <Zap className="h-4 w-4 text-[#10B981]" />
              {submitting ? 'Building…' : 'Generate Ads'}
            </button>
          </div>
        </div>

        {/* Sub-strip: Quick presets + Platform status pills + 7-day cap */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400">Try:</span>
            {DEMO_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setUrlInput(chip.url)}
                className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-2 py-0.5 font-mono text-slate-700 hover:border-[#18181B] hover:text-[#09090B]"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rail === 'byo' && (
              <>
                {metaStatus === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Meta Connected
                  </span>
                ) : onConnectPlatform ? (
                  <button
                    type="button"
                    onClick={() => onConnectPlatform('meta')}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <Link2 className="h-3 w-3" />
                    {metaStatus === 'needs_reconnect' ? 'Reconnect Meta' : 'Connect Meta'}
                  </button>
                ) : null}

                {redditStatus === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Reddit Connected
                  </span>
                ) : onConnectPlatform ? (
                  <button
                    type="button"
                    onClick={() => onConnectPlatform('reddit')}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 font-semibold text-[#09090B] hover:bg-slate-50"
                  >
                    <Link2 className="h-3 w-3" />
                    Connect Reddit
                  </button>
                ) : null}
              </>
            )}
            <span className="font-mono text-slate-500">
              7-day cap: {formatCurrency((effectiveBudget || 25) * 7, currency)}
            </span>
          </div>
        </div>
        {error && <p className="mt-2 text-caption font-medium text-red-600">{error}</p>}
      </form>

      {/* Full-Width 3-Column Bento Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Col 1 (4 cols): Campaigns */}
        <section className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500" />
              <h2 className="text-body font-semibold text-[#09090B]">Campaigns</h2>
            </div>
            <span className="rounded-full bg-[#FAFAFA] px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 border border-[#E5E7EB]">
              {goals.length}
            </span>
          </div>

          {goals.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <Sparkles className="h-6 w-6 text-slate-300" />
              <p className="mt-2 text-caption font-medium text-slate-600">No campaigns yet</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Enter a URL above to launch in one click.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {goals.map((goal) => (
                <a
                  key={goal.goalId}
                  href={routeHref({ section: 'goals', id: goal.goalId })}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-2.5 transition hover:border-[#18181B] hover:bg-white"
                >
                  <div className="min-w-0">
                    <div className="truncate text-body font-semibold text-[#09090B] group-hover:underline">
                      {goal.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <span>{goal.metrics?.budget ? `${formatCurrency(goal.metrics.budget, goal.metrics.currency ?? currency)}/d` : 'Auto cap'}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(goal.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <GoalStatusBadge status={goal.status} />
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#09090B]" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Col 2 (4 cols): Live Ad Preview */}
        <section className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <span className="text-body font-semibold text-[#09090B]">Ad Creative Preview</span>
            <span className="rounded-md bg-[#FAFAFA] px-2 py-0.5 font-mono text-[11px] text-slate-500 border border-[#E5E7EB]">
              Meta · Reddit
            </span>
          </div>

          <div className="mt-4 flex-1 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#18181B] font-mono text-[11px] font-bold text-white">
                  {previewHost.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-caption font-semibold text-[#09090B]">{previewHost}</div>
                  <div className="text-[10px] text-slate-400">Sponsored · Native Feed</div>
                </div>
              </div>
              <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 border border-[#E5E7EB]">
                {formatCurrency(effectiveBudget || 25, currency)}/d
              </span>
            </div>

            <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-3.5">
              <div className="text-body font-semibold text-[#09090B]">
                {matchedDemo ? matchedDemo.hook : `Grow ${previewHost} faster with AI-managed ads`}
              </div>
              <p className="mt-1.5 text-caption text-slate-600">
                Auto-researched from your site, paired with stock or AI visuals, and capped at{' '}
                {formatCurrency(effectiveBudget || 25, currency)}/day.
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-[11px]">
                <span className="font-mono text-slate-400 truncate">{previewHost}</span>
                <span className="rounded-md bg-[#18181B] px-2.5 py-1 font-semibold text-white">
                  Learn More
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Col 3 (4 cols): AI Brand Visibility (GEO) */}
        <section className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-slate-600" />
              <h2 className="text-body font-semibold text-[#09090B]">AI Brand Visibility (GEO)</h2>
            </div>
            <button
              type="button"
              onClick={handleRunGeoCheck}
              disabled={geoLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-caption font-semibold text-[#09090B] hover:bg-slate-50 disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" />
              {geoLoading ? 'Scanning…' : geoAudit ? 'Re-scan' : 'Scan LLMs'}
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {geoError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-caption text-red-700">
                {geoError}
              </div>
            )}

            {geoAudit ? (
              <>
                <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Visibility Score</div>
                    <div className="font-mono text-2xl font-bold text-[#09090B]">{geoAudit.visibilityScore}%</div>
                  </div>
                  <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700">
                    {previewHost}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ENGINE_LABELS) as GeoEngine[]).map((eng) => {
                    const stats = geoAudit.engineScores[eng];
                    const score = stats?.score ?? 0;
                    const mentioned = (stats?.mentions ?? 0) > 0;
                    return (
                    <div key={eng} className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
                      <div className="flex items-center justify-between text-caption">
                        <span className="font-semibold text-[#09090B]">{ENGINE_LABELS[eng]}</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">{score}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn('h-full rounded-full', mentioned ? 'bg-[#10B981]' : 'bg-amber-400')}
                          style={{ width: `${Math.max(6, score)}%` }}
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="grid grid-cols-2 gap-2">
                  {(['chatgpt', 'gemini', 'claude', 'perplexity'] as const).map((engine) => (
                    <div key={engine} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-caption">
                      <span className="font-semibold text-[#09090B]">{ENGINE_LABELS[engine]}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-slate-400">—</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Measures how often AI engines cite <span className="font-mono text-[#09090B]">{previewHost}</span>.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
