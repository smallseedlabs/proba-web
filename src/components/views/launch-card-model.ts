import type { AskPayload } from '../../lib/protocol';

type Props = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * The URL people land on when they click the ad: the card's own prop, else the drafted plan's
 * landingPageUrl (always the operator-entered URL), else the goal's URL. Never invented.
 */
export function cardDestination(uiProps: Props, draft: Props, goalLandingPageUrl?: string): string | undefined {
  return str(uiProps.landingPageUrl) ?? str(draft.landingPageUrl) ?? str(goalLandingPageUrl);
}

/** Only the card that creates the campaign spends; the plan card just saves copy, targeting and metric. */
export function isLaunchAsk(ask: AskPayload | undefined, uiProps: Props): boolean {
  if (!ask) return false;
  if (uiProps.toolName === 'ads.create_campaign') return true;
  if (uiProps.creativeDraft || uiProps.toolName === 'creative.draft_post' || ask.askType === 'plan_approval') return false;
  const proposed = (ask as { costEffect?: { proposed?: unknown } }).costEffect?.proposed;
  return typeof proposed === 'number' && Number.isFinite(proposed);
}

export function primaryActionLabel(ask: AskPayload | undefined, uiProps: Props, budgetText: string, submitting: boolean): string {
  const launch = isLaunchAsk(ask, uiProps);
  if (submitting) return launch ? 'Launching…' : 'Approving…';
  return launch ? `Approve Spend & Launch (${budgetText}/day)` : 'Approve plan';
}

/** Daily budget shown on the card: the ask's proposed cost, else the brain's planned daily budget, else the goal's. */
export function cardDailyBudget(costImpact: Props, uiProps: Props, plan: Props, goalDailyBudget: number): number {
  for (const v of [costImpact.proposed, uiProps.dailyBudget, plan.dailyBudget]) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return goalDailyBudget;
}

/** The user-entered URL the goal was researched on (the research card binds it), for the destination fallback. */
export function goalLandingPageUrlFromAsks(asks: ReadonlyArray<AskPayload | null | undefined>): string | undefined {
  for (const a of asks) {
    const url = str((a as { research?: { landingPageUrl?: unknown } } | null | undefined)?.research?.landingPageUrl);
    if (url) return url;
  }
  return undefined;
}
