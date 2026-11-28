import { describe, expect, it } from 'vitest';
import type { AskPayload } from '../../lib/protocol';
import { cardDailyBudget, cardDestination, goalLandingPageUrlFromAsks, isLaunchAsk, primaryActionLabel } from './launch-card-model';

const ask = (extra: Record<string, unknown> = {}) => ({ askId: 'a1', askType: 'action_approval', title: 't', ...extra }) as unknown as AskPayload;
const URL = 'https://example.com/post/1';

describe('plan/launch card invariants (any destination)', () => {
  it('shows the destination: card prop, else the plan URL, else the goal URL; never invented', () => {
    expect(cardDestination({ landingPageUrl: URL }, {}, 'https://goal.example/x')).toBe(URL);
    expect(cardDestination({}, { landingPageUrl: URL }, 'https://goal.example/x')).toBe(URL);
    expect(cardDestination({}, {}, URL)).toBe(URL);
    expect(cardDestination({}, {}, undefined)).toBeUndefined();
  });

  it('the plan card says Approve plan; only the create card says Approve Spend & Launch', () => {
    const planProps = { creativeDraft: { headline: 'h', landingPageUrl: URL }, plan: { successMetric: 'clicks' } };
    expect(isLaunchAsk(ask(), planProps)).toBe(false);
    expect(primaryActionLabel(ask(), planProps, '£5.00', false)).toBe('Approve plan');
    expect(primaryActionLabel(ask({ askType: 'plan_approval', costEffect: { proposed: 5 } }), {}, '£5.00', false)).toBe('Approve plan');
    const launchProps = { toolName: 'ads.create_campaign' };
    expect(isLaunchAsk(ask(), launchProps)).toBe(true);
    expect(primaryActionLabel(ask(), launchProps, '£5.00', false)).toBe('Approve Spend & Launch (£5.00/day)');
    expect(isLaunchAsk(ask({ costEffect: { proposed: 5, currency: 'GBP' } }), {})).toBe(true);
    expect(isLaunchAsk(ask(), {})).toBe(false);
  });

  it('shows the planned daily budget when the ask carries no cost', () => {
    expect(cardDailyBudget({}, {}, { dailyBudget: 5 }, 10)).toBe(5);
    expect(cardDailyBudget({ proposed: 4 }, {}, { dailyBudget: 5 }, 10)).toBe(4);
    expect(cardDailyBudget({}, {}, {}, 10)).toBe(10);
  });

  it('reads the goal URL from the research card', () => {
    expect(goalLandingPageUrlFromAsks([null, ask({ research: { landingPageUrl: URL } })])).toBe(URL);
    expect(goalLandingPageUrlFromAsks([ask()])).toBeUndefined();
  });
});
