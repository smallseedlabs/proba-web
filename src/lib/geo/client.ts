export type GeoEngine = 'chatgpt' | 'gemini' | 'claude' | 'perplexity';

export interface GeoPromptResult {
  prompt: string;
  engine: GeoEngine;
  mode: 'api' | 'web_search';
  mentioned: boolean;
  rank: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'absent';
  snippet: string;
  citedUrls: string[];
  competitorsMentioned: string[];
}

export interface CrawlabilityReport {
  domain: string;
  robotsTxtReachable: boolean;
  aiBotsStatus: Record<string, 'allowed' | 'blocked' | 'unspecified'>;
  llmsTxtFound: boolean;
  schemaTypesFound: string[];
  missingRecommendations: string[];
}

export interface InformationDocument {
  title: string;
  generatedAt: string;
  summary: string;
  crawlability: CrawlabilityReport;
  generatedLlmsTxt: string;
  generatedFaqJsonLd: string;
  comparisonBriefs: Array<{
    competitor: string;
    title: string;
    outline: string[];
  }>;
  organicCommunityThreads: Array<{
    url: string;
    domain: string;
    topic: string;
    suggestedAngle: string;
  }>;
}

export interface GeoDecisionProposal {
  kind: 'reddit_campaign' | 'sponsored_ai_ad';
  title: string;
  rationale: string;
  targetSubreddits?: string[];
  suggestedPlatform: string;
  suggestedPromptFocus: string;
}

export interface GeoAuditResult {
  auditId: string;
  workspaceId: string;
  goalId: string;
  brandName: string;
  domain: string;
  createdAt: string;
  visibilityScore: number;
  previousVisibilityScore: number | null;
  visibilityDelta: number | null;
  engineScores: Record<GeoEngine, { score: number; mode: 'api' | 'web_search'; mentions: number; total: number }>;
  competitorShareOfVoice: Array<{ name: string; mentions: number; sharePct: number }>;
  topCitedDomains: Array<{ domain: string; count: number; sampleUrls: string[] }>;
  promptResults: GeoPromptResult[];
  informationDocument: InformationDocument;
  decisionProposals: GeoDecisionProposal[];
}

export function geoBaseUrl(): string {
  const configured = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GEO_URL;
  return (configured || 'http://127.0.0.1:3850').replace(/\/+$/, '');
}

export async function getGeoEngineStatus(signal?: AbortSignal): Promise<Record<GeoEngine, 'api' | 'web_search'> | null> {
  try {
    const res = await fetch(`${geoBaseUrl()}/v1/geo/status`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { engines?: Record<GeoEngine, 'api' | 'web_search'> };
    return data.engines ?? null;
  } catch {
    return null;
  }
}

export async function getGoalGeoAudits(goalId: string, signal?: AbortSignal): Promise<GeoAuditResult[]> {
  try {
    const res = await fetch(`${geoBaseUrl()}/v1/geo/audits?goalId=${encodeURIComponent(goalId)}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { audits?: GeoAuditResult[] };
    return Array.isArray(data.audits) ? data.audits : [];
  } catch {
    return [];
  }
}

export async function runGoalGeoAudit(payload: {
  workspaceId: string;
  goalId: string;
  brandName: string;
  domain: string;
  competitors: string[];
  prompts: string[];
}): Promise<GeoAuditResult> {
  const res = await fetch(`${geoBaseUrl()}/v1/geo/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `GEO audit failed (HTTP ${res.status})`);
  }
  return (await res.json()) as GeoAuditResult;
}
