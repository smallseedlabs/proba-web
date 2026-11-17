import { useEffect, useState } from 'react';
import {
  getGoalGeoAudits,
  runGoalGeoAudit,
  type GeoAuditResult,
  type GeoDecisionProposal,
  type GeoEngine,
} from '../../lib/geo/client';
import { Badge, type Tone } from '../ui/badge';

const ENGINE_LABELS: Record<GeoEngine, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="rounded border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function GeoVisibilityPanel({
  workspaceId,
  goalId,
  brandName,
  landingPageUrl,
  onSendProposalToCopilot,
}: {
  workspaceId: string;
  goalId: string;
  brandName: string;
  landingPageUrl: string;
  onSendProposalToCopilot?: (promptText: string) => void;
}) {
  const [audits, setAudits] = useState<GeoAuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGoalGeoAudits(goalId).then((rows) => {
      if (!active) return;
      setAudits(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [goalId]);

  const latest = audits[0] ?? null;

  async function handleRunAudit() {
    setRunning(true);
    setError(null);
    try {
      const domainMatch = brandName.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
      const extractedHost = domainMatch?.[1]?.toLowerCase();
      const cleanBrand = extractedHost
        ? extractedHost.split('.')[0]
        : brandName.replace(/^campaign for\s+/i, '').trim() || brandName;
      const domain =
        landingPageUrl.trim() ||
        (extractedHost ? `https://${extractedHost}` : `${cleanBrand.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`);
      const prompts = customPrompts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const effectivePrompts =
        prompts.length > 0
          ? prompts
          : [
              `best ${cleanBrand} alternatives`,
              `what is ${cleanBrand} and is it worth it`,
              `top tools for ${cleanBrand} category`,
            ];
      const competitors = competitorsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await runGoalGeoAudit({
        workspaceId,
        goalId,
        brandName: cleanBrand,
        domain,
        competitors,
        prompts: effectivePrompts,
      });
      setAudits((prev) => [res, ...prev]);
    } catch (err) {
      setError((err as Error).message || 'Could not run AI visibility audit');
    } finally {
      setRunning(false);
    }
  }

  function handleProposeDecision(p: GeoDecisionProposal) {
    if (!onSendProposalToCopilot) return;
    const msg =
      p.kind === 'reddit_campaign'
        ? `Based on our AI Visibility audit, please draft a Reddit campaign${p.targetSubreddits?.length ? ` targeting ${p.targetSubreddits.join(', ')}` : ''} focused on "${p.suggestedPromptFocus}". Rationale: ${p.rationale}`
        : `Based on our AI Visibility audit, please propose a sponsored AI answer placement on ${p.suggestedPlatform} for "${p.suggestedPromptFocus}". Rationale: ${p.rationale}`;
    onSendProposalToCopilot(msg);
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 text-[#0B0D12] shadow-sm" aria-label="AI Brand Visibility (GEO)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-section font-semibold text-foreground">AI Brand Visibility (GEO)</h3>
            {latest && (
              <Badge tone={latest.visibilityScore >= 50 ? 'success' : latest.visibilityScore >= 20 ? 'warning' : 'neutral'}>
                {latest.visibilityScore}% visible
                {latest.visibilityDelta !== null && latest.visibilityDelta !== 0
                  ? ` (${latest.visibilityDelta > 0 ? '+' : ''}${latest.visibilityDelta}%)`
                  : ''}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-caption text-muted-foreground">
            Measures how often ChatGPT, Gemini, Claude, and Perplexity recommend {brandName}, then turns gaps into an Information Document & Decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {latest && (
            <button
              type="button"
              onClick={() => setShowDoc((v) => !v)}
              className="rounded-lg border bg-background px-3 py-1.5 text-caption font-medium text-foreground hover:bg-muted"
            >
              {showDoc ? 'Hide Information Document' : 'Document of Information'}
            </button>
          )}
          <button
            type="button"
            disabled={running}
            onClick={handleRunAudit}
            className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-caption font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {running ? 'Auditing LLMs…' : latest ? 'Re-check Visibility' : 'Run AI Visibility Audit'}
          </button>
        </div>
      </div>

      {/* Prompt / Competitor configuration */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={competitorsInput}
          onChange={(e) => setCompetitorsInput(e.target.value)}
          placeholder="Competitors (comma-separated, e.g. CompetitorA, CompetitorB)"
          className="rounded-lg border bg-background px-2.5 py-1.5 text-caption text-foreground"
        />
        <input
          type="text"
          value={customPrompts.replace(/\n/g, ' | ')}
          onChange={(e) => setCustomPrompts(e.target.value.replace(/ \| /g, '\n'))}
          placeholder="Optional custom prompts (or leave blank for auto buyer-intent prompts)"
          className="rounded-lg border bg-background px-2.5 py-1.5 text-caption text-foreground"
        />
      </div>

      {error && <p className="mt-2 text-caption text-danger">{error}</p>}
      {loading && <p className="mt-3 text-caption text-muted-foreground">Loading AI visibility history…</p>}

      {!loading && latest && (
        <div className="mt-4 space-y-4">
          {/* Engine Breakdown */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(ENGINE_LABELS) as GeoEngine[]).map((eng) => {
              const s = latest.engineScores[eng];
              const tone: Tone = s.score >= 50 ? 'success' : s.score > 0 ? 'warning' : 'neutral';
              return (
                <div key={eng} className="rounded-lg border bg-background/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold text-foreground">{ENGINE_LABELS[eng]}</span>
                    <Badge tone={tone}>{s.score}%</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{s.mentions}/{s.total} prompts</span>
                    <span>{s.mode === 'api' ? 'Live API' : 'Web Search'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Competitor Share of Voice & Top Cited Domains */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-caption font-semibold text-foreground">Share of AI Voice</div>
              <div className="mt-2 space-y-1.5">
                {latest.competitorShareOfVoice.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-caption">
                    <span className="w-28 truncate font-medium text-foreground">{c.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(4, c.sharePct)}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums text-muted-foreground">{c.sharePct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-caption font-semibold text-foreground">Top Cited Sources</div>
              {latest.topCitedDomains.length === 0 ? (
                <p className="mt-2 text-caption text-muted-foreground">No external citations captured in this run.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-caption">
                  {latest.topCitedDomains.slice(0, 5).map((d) => (
                    <li key={d.domain} className="flex items-center justify-between">
                      <span className="truncate font-mono text-[12px] text-foreground">{d.domain}</span>
                      <span className="text-muted-foreground">{d.count} citations</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Document of Information (Crawlability, llms.txt, FAQ JSON-LD, Comparison Briefs, Organic Threads) */}
          {showDoc && (
            <div className="rounded-xl border border-primary/30 bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-body font-semibold text-foreground">{latest.informationDocument.title}</h4>
                <span className="text-[11px] text-muted-foreground">Technical & Content Playbook</span>
              </div>
              <p className="text-caption text-muted-foreground">{latest.informationDocument.summary}</p>

              {/* AI Crawler status */}
              <div>
                <div className="text-caption font-semibold text-foreground">AI Crawler Status (robots.txt)</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(latest.informationDocument.crawlability.aiBotsStatus).map(([bot, status]) => (
                    <Badge key={bot} tone={status === 'blocked' ? 'danger' : status === 'allowed' ? 'success' : 'neutral'}>
                      {bot}: {status}
                    </Badge>
                  ))}
                  <Badge tone={latest.informationDocument.crawlability.llmsTxtFound ? 'success' : 'warning'}>
                    /llms.txt: {latest.informationDocument.crawlability.llmsTxtFound ? 'Found' : 'Missing'}
                  </Badge>
                </div>
                {latest.informationDocument.crawlability.missingRecommendations.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-caption text-foreground">
                    {latest.informationDocument.crawlability.missingRecommendations.map((rec) => (
                      <li key={rec}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Copyable llms.txt + FAQPage JSON-LD */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-surface p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold">Ready-to-deploy /llms.txt</span>
                    <CopyButton text={latest.informationDocument.generatedLlmsTxt} />
                  </div>
                  <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {latest.informationDocument.generatedLlmsTxt}
                  </pre>
                </div>
                <div className="rounded-lg border bg-surface p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold">FAQPage JSON-LD Schema</span>
                    <CopyButton text={latest.informationDocument.generatedFaqJsonLd} />
                  </div>
                  <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {latest.informationDocument.generatedFaqJsonLd}
                  </pre>
                </div>
              </div>

              {/* Organic Community Threads */}
              {latest.informationDocument.organicCommunityThreads.length > 0 && (
                <div>
                  <div className="text-caption font-semibold text-foreground">Cited Community & Review Threads (Organic Playbook)</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {latest.informationDocument.organicCommunityThreads.map((t) => (
                      <li key={t.url} className="rounded border bg-surface p-2 text-caption">
                        <div className="flex items-center justify-between gap-2">
                          <a href={t.url} target="_blank" rel="noreferrer" className="truncate font-medium text-primary hover:underline">
                            {t.url}
                          </a>
                          <span className="text-[11px] text-muted-foreground">{t.domain}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{t.suggestedAngle}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actionable Decision Proposals */}
          {latest.decisionProposals.length > 0 && (
            <div className="space-y-2">
              <div className="text-caption font-semibold text-foreground">Recommended Marketing Decisions</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {latest.decisionProposals.map((p, idx) => (
                  <div key={idx} className="rounded-lg border bg-background/70 p-3">
                    <div className="text-caption font-semibold text-foreground">{p.title}</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{p.rationale}</p>
                    {onSendProposalToCopilot && (
                      <button
                        type="button"
                        onClick={() => handleProposeDecision(p)}
                        className="mt-2 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                      >
                        Create Decision in Co-pilot →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Breakdown */}
          <div>
            <div className="text-caption font-semibold text-foreground">Prompt-by-Prompt Breakdown</div>
            <div className="mt-1.5 divide-y rounded-lg border bg-background/60">
              {Array.from(new Set(latest.promptResults.map((r) => r.prompt))).map((promptText) => {
                const rows = latest.promptResults.filter((r) => r.prompt === promptText);
                const isOpen = expandedPrompt === promptText;
                return (
                  <div key={promptText} className="p-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedPrompt(isOpen ? null : promptText)}
                      className="flex w-full items-center justify-between gap-2 text-left text-caption"
                    >
                      <span className="font-medium text-foreground">{promptText}</span>
                      <div className="flex items-center gap-1.5">
                        {rows.map((r) => (
                          <Badge key={r.engine} tone={r.mentioned ? 'success' : 'neutral'}>
                            {ENGINE_LABELS[r.engine]}: {r.mentioned ? `#${r.rank ?? 1}` : '—'}
                          </Badge>
                        ))}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-2 border-t pt-2">
                        {rows.map((r) => (
                          <div key={r.engine} className="rounded border bg-surface p-2 text-[11px]">
                            <div className="flex items-center justify-between font-semibold text-foreground">
                              <span>{ENGINE_LABELS[r.engine]} ({r.mode === 'api' ? 'Live API' : 'Web Search'})</span>
                              <span>{r.mentioned ? `Mentioned (Rank #${r.rank ?? 1}, ${r.sentiment})` : 'Not mentioned'}</span>
                            </div>
                            <p className="mt-1 text-muted-foreground">{r.snippet}</p>
                            {r.citedUrls.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {r.citedUrls.slice(0, 4).map((u) => (
                                  <a key={u} href={u} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                    {u}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
