import { describe, it, expect } from 'vitest';
import type { AskPayload } from '@smallseedlabs/proba-protocol';
import {
  buildCreateGoalPayload,
  buildResearchAnswerPayload,
  displayedResearch,
  parseOptionalLandingPageUrl,
  researchBindingFromAsk,
  safeHttpHref,
} from './research';

const ARTIFACT_ID = 'aa0e8400-e29b-41d4-a716-446655440010';
const ASK_ID = 'bb0e8400-e29b-41d4-a716-446655440011';
const REVISION = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const LANDING = 'https://operator-entered.example/path';

function reviewAsk(overrides: Partial<AskPayload> = {}): AskPayload {
  return {
    askId: ASK_ID,
    askType: 'research_review',
    title: 'Review sourced research',
    description: 'This is not campaign spend approval.',
    blocking: true,
    risk: 'high',
    onExpire: 'deny',
    questions: [
      {
        id: 'research-accept',
        type: 'confirm',
        label: 'Accept this sourced research for the current operator-entered landing URL?',
        required: true,
      },
    ],
    research: {
      verb: 'research.accept',
      artifactId: ARTIFACT_ID,
      version: 1,
      inputRevision: REVISION,
      landingPageUrl: LANDING,
      status: 'awaiting_acceptance',
      findings: [{ id: 'f1', text: 'The page describes an example offer.', sourceIds: ['page-1'] }],
      assumptions: [{ id: 'a1', text: 'Operator supplied the landing URL.', basis: 'user_input' }],
      unknowns: [{ id: 'u1', text: 'Audience was not verified.' }],
      sources: [{ sourceId: 'page-1', kind: 'http_url', url: LANDING, sha256: SHA }],
    },
    ...overrides,
  };
}

describe('buildCreateGoalPayload', () => {
  it('omits userSuppliedInput when the landing URL is blank and never inserts a default host', () => {
    const blank = buildCreateGoalPayload({ title: 'Test demand', currency: 'USD', landingPageUrl: '' });
    expect(blank).toEqual({ ok: true, payload: { title: 'Test demand' } });
    expect(JSON.stringify(blank)).not.toMatch(/smallseedlabs/i);
    expect(JSON.stringify(blank)).not.toContain('userSuppliedInput');
    expect(JSON.stringify(blank)).not.toContain('landingPageUrl');

    const omitted = buildCreateGoalPayload({ title: 'Test demand', currency: 'USD' });
    expect(omitted.ok).toBe(true);
    if (omitted.ok) expect(omitted.payload.userSuppliedInput).toBeUndefined();
  });

  it('passes the operator URL through userSuppliedInput.landingPageUrl', () => {
    const result = buildCreateGoalPayload({
      title: 'Launch',
      description: 'Context',
      dailyBudget: 120,
      currency: 'USD',
      landingPageUrl: LANDING,
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        title: 'Launch',
        description: 'Context',
        budget: { daily: 120, currency: 'USD' },
        userSuppliedInput: { landingPageUrl: LANDING },
      },
    });
  });

  it('rejects malformed, credentialed, and non-http URLs without substituting a default', () => {
    for (const raw of [
      'not-a-url',
      'javascript:alert(1)',
      'ftp://example.com',
      'https://user:pass@example.com',
      ' https://operator-entered.example/path',
      'https://operator-entered.example/path ',
    ]) {
      const result = buildCreateGoalPayload({ title: 'Launch', currency: 'USD', landingPageUrl: raw });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.toLowerCase()).not.toMatch(/smallseedlabs/);
        expect(result.message).toMatch(/landingPageUrl|http|credential|whitespace|valid/i);
      }
    }
  });
});

describe('parseOptionalLandingPageUrl', () => {
  it('treats an empty string as omit, not as a default destination', () => {
    expect(parseOptionalLandingPageUrl('')).toEqual({ ok: true });
  });
});

describe('safeHttpHref', () => {
  it('allows only http(s) URLs without credentials', () => {
    expect(safeHttpHref(LANDING)).toBe(LANDING);
    expect(safeHttpHref('http://example.com/x')).toBe('http://example.com/x');
    expect(safeHttpHref('javascript:alert(1)')).toBeNull();
    expect(safeHttpHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHttpHref('https://user:pass@example.com/')).toBeNull();
    expect(safeHttpHref('<img src=x onerror=alert(1)>')).toBeNull();
  });
});

describe('research answer payload', () => {
  it('binds approve/reject/edit to the currently displayed artifact and never grants spend', () => {
    const ask = reviewAsk();
    const approve = buildResearchAnswerPayload(ask, 'approve');
    expect(approve).toMatchObject({
      ok: true,
      grantsSpend: false,
      payload: {
        askId: ASK_ID,
        choice: 'approve',
        researchAcceptance: { artifactId: ARTIFACT_ID, version: 1, inputRevision: REVISION },
      },
    });
    if (approve.ok) expect(approve.payload.userSuppliedInput).toBeUndefined();

    const reject = buildResearchAnswerPayload(ask, 'reject');
    expect(reject.ok).toBe(true);
    if (reject.ok) {
      expect(reject.grantsSpend).toBe(false);
      expect(reject.payload.choice).toBe('reject');
      expect(reject.payload.researchAcceptance).toEqual(approve.ok && approve.payload.researchAcceptance);
    }

    const edited = buildResearchAnswerPayload(ask, 'edit', { landingPageUrl: 'https://operator-entered.example/new-path' });
    expect(edited).toMatchObject({
      ok: true,
      grantsSpend: false,
      payload: {
        choice: 'edit',
        researchAcceptance: { artifactId: ARTIFACT_ID, version: 1, inputRevision: REVISION },
        userSuppliedInput: { landingPageUrl: 'https://operator-entered.example/new-path' },
      },
    });
  });

  it('refuses missing artifacts and unsourced findings', () => {
    const missing = reviewAsk({ research: undefined });
    expect(displayedResearch(missing)).toBeNull();
    expect(researchBindingFromAsk(missing)).toBeNull();
    const approveMissing = buildResearchAnswerPayload(missing, 'approve');
    expect(approveMissing.ok).toBe(false);

    const unsourced = reviewAsk();
    unsourced.research = {
      ...unsourced.research!,
      findings: [{ id: 'f1', text: 'Invented claim', sourceIds: ['missing-source'] }],
    };
    expect(displayedResearch(unsourced)).toBeNull();
    expect(buildResearchAnswerPayload(unsourced, 'approve').ok).toBe(false);
  });

  it('refuses a stale binding that does not match the displayed artifact', () => {
    const ask = reviewAsk();
    const built = buildResearchAnswerPayload(ask, 'approve');
    expect(built.ok).toBe(true);
    const staleAsk = reviewAsk({
      research: {
        ...ask.research!,
        version: 2,
        inputRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    });
    const stale = buildResearchAnswerPayload(staleAsk, 'approve');
    expect(stale.ok).toBe(true);
    if (stale.ok && built.ok) {
      expect(stale.payload.researchAcceptance).toBeDefined();
      expect(built.payload.researchAcceptance).toBeDefined();
      expect(stale.payload.researchAcceptance).not.toEqual(built.payload.researchAcceptance);
      expect(stale.payload.researchAcceptance?.version).toBe(2);
    }
  });

  it('requires a new operator URL on edit and does not prefill a destination', () => {
    const ask = reviewAsk();
    const emptyEdit = buildResearchAnswerPayload(ask, 'edit');
    expect(emptyEdit.ok).toBe(false);
    const badEdit = buildResearchAnswerPayload(ask, 'edit', { landingPageUrl: 'javascript:alert(1)' });
    expect(badEdit.ok).toBe(false);
  });
});
