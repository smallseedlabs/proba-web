# Research review (web operator slice)

Web-only operator UI for an operator-entered landing URL and a sourced research
review card. This is **not** spend approval, campaign launch, Hub forwarding, or
live page fetch.

Portal stays Insights admin. Operator entry is this app (`proba-web`).

## Protocol pin (unmerged prerequisite)

`@smallseedlabs/proba-protocol` is pinned to the **commit SHA**, not a tag:

```
github:smallseedlabs/proba-protocol#298eeb4b4ba3fe14b4bf5077810ce2f433067984
```

That is protocol **PR23** head (package **0.6.0**: PR22 research schemas + patched
Zod 4.6.7). There is **no** `v0.6.0` tag. Do not pin a nonexistent tag, leftover
`feat/context-bridge-v0.4.0`, or the older PR23 SHA `e310475…`.

Verified live (open, mergeable):

| PR | Base | Head |
| --- | --- | --- |
| [protocol #22](https://github.com/smallseedlabs/proba-protocol/pull/22) research 0.5.0 | **`main`** (`ce3917fe2e78f270d8e2e78bbc9afe91adea8cd1`) | `d043b2f584b0d631d58b7c34a34c44f4b44f8f4b` |
| [protocol #23](https://github.com/smallseedlabs/proba-protocol/pull/23) Zod 4 / 0.6.0 | **#22 head** (`cursor/research-review-contract-ac36` / `d043b2f…`) | `298eeb4b4ba3fe14b4bf5077810ce2f433067984` |

v0.4.0 already landed on `main` (squash #21). `feat/context-bridge-v0.4.0` is
**not** the integration path.

Web **type-imports** 0.6.0. URL / artifact checks used at runtime are the same
I/O-free rules, implemented in `src/lib/research.ts`, because the protocol
package barrel imports Node `crypto` and cannot be bundled into this browser
app. App `zod` is `^4.6.6` in the same bump. We do not publish, tag, or modify
the protocol package.

Gateway contract (also unmerged):
[proba-llm-gateway PR4](https://github.com/smallseedlabs/proba-llm-gateway/pull/4)
at `86630d02cbbeb6b6459676b547c41064d6df3321`
(`docs/RESEARCH_REVIEW_CONTRACT.md`).

## What this slice sends and renders

1. **Create goal** (`NewGoalDialog`): optional landing URL from the operator.
   Blank omits `userSuppliedInput`. A valid URL is sent as
   `create_goal.payload.userSuppliedInput.landingPageUrl`. There is no default
   host (including no `smallseedlabs.com`) and no auto-prefill.
2. **Research review ask**: if Hub later emits `askType: "research_review"` with
   `payload.research`, Web renders findings, assumptions, unknowns, source
   links, and artifact / version / `inputRevision`. It does **not** reuse the
   budget `approval_card`. Clarify / plan / action cards are unchanged.
3. **Answer**: approve / reject / edit send `answer_ask` with
   `researchAcceptance` copied from the **currently displayed** artifact.
   Edit requires a new operator URL (field starts empty) and invalidates
   acceptance. `grantsSpend` is always false.

Untrusted source/page text is React text (escaped). Only `http:` / `https:`
URLs without credentials become links. `javascript:`, `data:`, and credentialed
URLs render as text.

## Backend prerequisite (not in this PR)

Hub does **not** yet:

- copy `command.payload.userSuppliedInput` onto `POST /v1/runs`
- map gateway `research.accept` needs to `buildResearchReviewAskEvent`
- persist research review beyond gateway `RESEARCH_STORE_DIR`
- forward `researchAcceptance` on resume

A Hub still on protocol ≤0.4.0 **strips** unknown keys (Zod 3 default), so
`userSuppliedInput` never reaches the gateway. Prior Hub / LLM sanctioned PR
publication refusals remain **final**. This repo does not retry or workaround
them.

Until those land, the UI can send the command and render a Hub-authored
`research_review` event, but **full E2E research → accept → create_campaign is
not possible**. `ads.create_campaign` still needs its own `action_approval`,
Hub human approval, and gateway mutate preflight.

## Local development and tests (no live providers)

Do **not** enable a live gateway, paid Ads path, or real model calls.

```bash
# Unit tests (payload, blank URL, malformed URL, escaping, missing artifact, edit, legacy cards)
npm test

# Typecheck, lint, production build (demo code stripped)
npm run typecheck && npm run lint && npm run build && npm run check:bundle

# Demo UI only — sample workspace, no research gather, no launched campaigns
npm run dev:demo
```

In demo mode, creating a goal with a landing URL records the field and states
explicitly that the demo does **not** gather research, accept research, or
launch campaigns. Demo seed data has **no** `research_review` ask.

Against a real Hub (still incomplete for this slice):

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

That talks to Hub only. It does not turn on `RESEARCH_HTTP_FETCH`, Ads spend,
or gateway live fetch. Leave those off.

Docker image build (static nginx; no Hub, no gateway):

```bash
docker build -t proba-web:research-review .
```

## Merge order

1. Gateway PR4 (research artifact + `userSuppliedInput` on runs)
2. Protocol **PR22** (0.5.0 research) into **`main`** — merge first
3. Protocol **PR23** (0.6.0 Zod 4) — currently stacked on #22; **retarget `main`** after #22 merges, then merge
4. This web PR (pins #23 head `298eeb4…`; user merges)
5. Hub forwarding + persistence (not started; sanctioned refusals stand)

Do not merge protocol work into leftover `feat/context-bridge-v0.4.0`. Do not
merge from this agent.

## What this slice does not claim

- Hub or gateway implementation
- Live vendor crawl / paid ads / deployment
- Replacing spend approval
- Full create-campaign E2E
- Portal operator entry
