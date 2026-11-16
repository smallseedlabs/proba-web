import { useState, type FormEvent } from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { cn } from '../../lib/utils/cn';
import { useWorkspace } from '../../state/workspace';

const BUDGET_PILLS = [
  { amount: 10, label: '$10/day', tag: 'Test Waters' },
  { amount: 25, label: '$25/day', tag: 'Sweet Spot ✨' },
  { amount: 50, label: '$50/day', tag: 'Send It 🚀' },
] as const;

const DEMO_CHIPS = [
  { label: 'Try: Indie SaaS', url: 'https://smallseedlabs.co.uk' },
  { label: 'Try: DTC Skincare', url: 'https://aesop.com' },
  { label: 'Try: AI Waitlist', url: 'https://linear.app' },
] as const;

export function MagicPromptCanvas({
  hasConnectedPlatform,
  userRole,
  onConnectPlatform,
  onCreated,
}: {
  hasConnectedPlatform: boolean;
  userRole: string;
  onConnectPlatform?: (provider: 'meta' | 'reddit') => void;
  onCreated?: () => void;
}) {
  const { createGoal } = useWorkspace();
  const [urlInput, setUrlInput] = useState('');
  const [budget, setBudget] = useState<number>(25);
  const [customBudget, setCustomBudget] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [rail, setRail] = useState<'managed' | 'byo'>(hasConnectedPlatform ? 'byo' : 'managed');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBudget = isCustom ? Number(customBudget) || 25 : budget;

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
    <div className="relative mx-auto w-full max-w-2xl py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/25 via-indigo-500/20 to-emerald-400/20 blur-3xl"
      />
      <div className="relative rounded-2xl border border-white/10 bg-[#12121A]/95 p-6 shadow-2xl sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300">
          <Sparkles className="h-3 w-3" />
          Autonomous Ad Agent
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Drop your URL. We’ll handle the ads.
        </h1>
        <p className="mt-1.5 text-body text-slate-400">
          Proba scans your site, writes native Meta &amp; Reddit ads, and launches in one click.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="url"
                inputMode="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://yourproduct.com"
                className="flex-1 rounded-xl border border-white/15 bg-[#09090D] px-4 py-3 text-body text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 px-5 py-3 text-body font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:opacity-95 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {submitting ? 'Generating…' : 'Generate Ads'}
              </button>
            </div>
            {error && <p className="mt-2 text-caption text-rose-400">{error}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
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

          {/* Account Rail Selector (Tier 1 Managed vs Tier 2 BYO OAuth) */}
          <div className="rounded-xl border border-white/10 bg-[#09090D]/80 p-3">
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
                ⚡ Proba Managed Account (Instant · No setup)
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
    </div>
  );
}
