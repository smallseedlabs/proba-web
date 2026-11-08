/**
 * Operator-side research review helpers.
 *
 * Types come from proba-protocol at
 * 298eeb4b4ba3fe14b4bf5077810ce2f433067984 (unmerged PR23, package 0.6.0;
 * research fields since PR22 0.5.0). There is no v0.6.0 tag. Do not pin
 * leftover feat/context-bridge-v0.4.0.
 *
 * Value helpers are copied here (I/O-free, same rules as that SHA). The
 * protocol package barrel imports Node `crypto`, which cannot be bundled
 * into this browser app. This module does not fetch pages, call models, or
 * grant spend.
 */

import type {
  AnswerAskPayload,
  AskPayload,
  CreateGoalPayload,
  ResearchAcceptanceBinding,
  ResearchReviewAsk,
} from '@smallseedlabs/proba-protocol';

export const LANDING_PAGE_URL_MAX = 2048;
export const RESEARCH_ACCEPT_VERB = 'research.accept';

export const NO_DEFAULT_LANDING_URL_MESSAGE =
  'Enter the landing page URL yourself. There is no default destination.';

export type LandingPageUrlParseResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * Syntactic checks for an operator-entered landing URL. Same rules as
 * protocol `parseLandingPageUrl` at 298eeb4. Callers must not default,
 * hardcode, or auto-prefill a URL.
 */
export function parseLandingPageUrl(raw: unknown): LandingPageUrlParseResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return {
      ok: false,
      message: 'landingPageUrl is required and must be supplied; there is no default destination',
    };
  }
  if (raw.length > LANDING_PAGE_URL_MAX) {
    return { ok: false, message: 'landingPageUrl is too long' };
  }
  if (raw !== raw.trim()) {
    return { ok: false, message: 'landingPageUrl must not include leading or trailing whitespace' };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: 'landingPageUrl is not a valid absolute URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'landingPageUrl must be http or https' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'landingPageUrl must not include credentials' };
  }
  if (!parsed.hostname) {
    return { ok: false, message: 'landingPageUrl must include a hostname' };
  }
  return { ok: true, url: raw };
}

export type CreateGoalInput = {
  title: string;
  description?: string;
  dailyBudget?: number;
  currency: string;
  /** Operator-entered. Empty/omitted is valid; do not default it. */
  landingPageUrl?: string;
};

export type CreateGoalPayloadResult = { ok: true; payload: CreateGoalPayload } | { ok: false; message: string };

/**
 * Build a create_goal payload. Blank landing URL omits userSuppliedInput.
 * Never inserts a default host (including smallseedlabs.com).
 */
export function buildCreateGoalPayload(input: CreateGoalInput): CreateGoalPayloadResult {
  const payload: CreateGoalPayload = { title: input.title };
  if (input.description) payload.description = input.description;
  if (input.dailyBudget) payload.budget = { daily: input.dailyBudget, currency: input.currency };

  const raw = input.landingPageUrl;
  if (raw === undefined || raw === '') {
    return { ok: true, payload };
  }
  const parsed = parseLandingPageUrl(raw);
  if (!parsed.ok) return parsed;
  payload.userSuppliedInput = { landingPageUrl: parsed.url };
  return { ok: true, payload };
}

/**
 * Optional dialog field: empty is omit; anything else must pass protocol URL rules.
 */
export function parseOptionalLandingPageUrl(raw: string): { ok: true; url?: string } | { ok: false; message: string } {
  if (raw === '') return { ok: true };
  const parsed = parseLandingPageUrl(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, url: parsed.url };
}

/**
 * Only http(s) URLs without credentials may become hrefs. javascript:, data:,
 * and other schemes render as text. The original string is returned so React
 * can escape it; it is never executed.
 */
export function safeHttpHref(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname) return null;
    return raw;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/;

function sourceIdsExist(sources: ReadonlyArray<{ sourceId: string }>, sourceIds: readonly string[]): boolean {
  const ids = new Set(sources.map((row) => row.sourceId));
  return sourceIds.every((id) => ids.has(id));
}

/** Findings without provenance are not research. Context items are not sources. */
export function researchFindingsAreSourced(
  sources: ReadonlyArray<{ sourceId: string }>,
  findings: ReadonlyArray<{ sourceIds: readonly string[] }>
): boolean {
  if (sources.length === 0 || findings.length === 0) return false;
  return findings.every((finding) => finding.sourceIds.length > 0 && sourceIdsExist(sources, finding.sourceIds));
}

function isResearchReviewAsk(value: unknown): value is ResearchReviewAsk {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ResearchReviewAsk>;
  if (row.verb !== RESEARCH_ACCEPT_VERB) return false;
  if (row.status !== 'awaiting_acceptance') return false;
  if (typeof row.artifactId !== 'string' || !UUID_RE.test(row.artifactId)) return false;
  if (typeof row.version !== 'number' || !Number.isInteger(row.version) || row.version < 1) return false;
  if (typeof row.inputRevision !== 'string' || row.inputRevision.length === 0 || row.inputRevision.length > 128) {
    return false;
  }
  if (!parseLandingPageUrl(row.landingPageUrl).ok) return false;
  if (!Array.isArray(row.findings) || row.findings.length === 0 || row.findings.length > 32) return false;
  if (!Array.isArray(row.sources) || row.sources.length === 0 || row.sources.length > 32) return false;
  if (!Array.isArray(row.assumptions) || row.assumptions.length > 32) return false;
  if (!Array.isArray(row.unknowns) || row.unknowns.length > 32) return false;
  if (!row.findings.every((finding) => finding.id && finding.text && Array.isArray(finding.sourceIds) && finding.sourceIds.length > 0)) {
    return false;
  }
  if (
    !row.sources.every(
      (source) =>
        source.sourceId &&
        source.kind === 'http_url' &&
        typeof source.url === 'string' &&
        SHA256_RE.test(source.sha256)
    )
  ) {
    return false;
  }
  return researchFindingsAreSourced(row.sources, row.findings);
}

export function displayedResearch(ask: AskPayload): ResearchReviewAsk | null {
  if (ask.askType !== 'research_review') return null;
  return isResearchReviewAsk(ask.research) ? ask.research : null;
}

export function researchBindingFromAsk(ask: AskPayload): ResearchAcceptanceBinding | null {
  const research = displayedResearch(ask);
  if (!research) return null;
  return {
    artifactId: research.artifactId,
    version: research.version,
    inputRevision: research.inputRevision,
  };
}

export function researchAcceptanceMatches(
  review: Pick<ResearchReviewAsk, 'artifactId' | 'version' | 'inputRevision'>,
  binding: ResearchAcceptanceBinding
): boolean {
  return (
    review.artifactId === binding.artifactId &&
    review.version === binding.version &&
    review.inputRevision === binding.inputRevision
  );
}

export type ResearchReviewAnswerOutcome = 'accepted' | 'rejected' | 'invalidated' | 'mismatch' | 'invalid';

export interface ResearchReviewAnswerResult {
  outcome: ResearchReviewAnswerOutcome;
  message: string;
  grantsSpend: false;
}

/**
 * Same rules as protocol `evaluateResearchReviewAnswer` at 298eeb4.
 * Matching ids is not a spend grant.
 */
export function evaluateResearchReviewAnswer(ask: AskPayload, answer: AnswerAskPayload): ResearchReviewAnswerResult {
  const noSpend = { grantsSpend: false as const };
  if (ask.askType !== 'research_review' || !ask.research) {
    return {
      outcome: 'invalid',
      message: 'evaluateResearchReviewAnswer applies only to askType research_review',
      ...noSpend,
    };
  }
  if (answer.askId !== ask.askId) {
    return { outcome: 'mismatch', message: 'answer askId does not match the research review ask', ...noSpend };
  }
  if (!answer.researchAcceptance) {
    return {
      outcome: 'mismatch',
      message:
        'research_review answers require researchAcceptance bound to the current artifactId, version, and inputRevision',
      ...noSpend,
    };
  }
  if (!researchAcceptanceMatches(ask.research, answer.researchAcceptance)) {
    return {
      outcome: 'mismatch',
      message:
        'researchAcceptance does not match the current artifact revision; stale or model-supplied ids are not acceptance',
      ...noSpend,
    };
  }
  if (answer.choice === 'approve') {
    return {
      outcome: 'accepted',
      message:
        'Research artifact version accepted for this input revision. Spend policies, budget caps, and ads.create_campaign approval still apply.',
      ...noSpend,
    };
  }
  if (answer.choice === 'edit') {
    return {
      outcome: 'invalidated',
      message: answer.userSuppliedInput
        ? 'Acceptance invalidated. Hub must gather and accept the new userSuppliedInput landing URL revision before create.'
        : 'Acceptance invalidated. Collect a replacement operator URL (new input revision) or re-gather the current URL; create stays blocked.',
      ...noSpend,
    };
  }
  return {
    outcome: 'rejected',
    message: 'Research artifact left unaccepted. ads.create_campaign stays blocked.',
    ...noSpend,
  };
}

export type ResearchAnswerPayloadResult =
  | { ok: true; payload: AnswerAskPayload; grantsSpend: false }
  | { ok: false; message: string };

/**
 * Bind answer_ask to the artifact currently displayed. A caller-supplied
 * stale id is ignored. Approval never grants spend.
 */
export function buildResearchAnswerPayload(
  ask: AskPayload,
  choice: AnswerAskPayload['choice'],
  extra?: { landingPageUrl?: string; edit?: string }
): ResearchAnswerPayloadResult {
  const binding = researchBindingFromAsk(ask);
  if (!binding) {
    return {
      ok: false,
      message:
        'This research review has no current sourced artifact. Accepting it would not bind a revision, and it is not spend approval.',
    };
  }

  if (choice === 'edit') {
    if (!extra?.landingPageUrl) {
      return { ok: false, message: 'Edit requires a new operator-entered landing URL. The current URL is not prefilled.' };
    }
    const parsed = parseLandingPageUrl(extra.landingPageUrl);
    if (!parsed.ok) return parsed;
  }

  const payload: AnswerAskPayload = {
    askId: ask.askId,
    choice,
    researchAcceptance: binding,
  };
  if (choice === 'edit' && extra?.landingPageUrl) {
    payload.userSuppliedInput = { landingPageUrl: extra.landingPageUrl };
  }
  if (extra?.edit) payload.edit = extra.edit;

  const result = evaluateResearchReviewAnswer(ask, payload);
  if (result.outcome === 'mismatch' || result.outcome === 'invalid') {
    return { ok: false, message: result.message };
  }
  return { ok: true, payload, grantsSpend: false };
}

export function researchAnswerCommand(payload: AnswerAskPayload) {
  return {
    type: 'answer_ask' as const,
    payload: payload as unknown as Record<string, unknown>,
  };
}
