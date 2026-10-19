import type { IncomingEvent } from '../transport';

export const THREADS = {
  boot: '6c0a3c52-5b1e-4f0e-9a51-0b6f3a1d2e01',
  jacket: '6c0a3c52-5b1e-4f0e-9a51-0b6f3a1d2e02',
  holiday: '6c0a3c52-5b1e-4f0e-9a51-0b6f3a1d2e03',
} as const;

export const GOALS = {
  boot: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d01',
  jacket: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d02',
  holiday: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d03',
} as const;

export const ASKS = {
  audience: '3f6e2a10-7b4c-4d8e-9a1f-5c2b3d4e6f01',
  launchPlan: '3f6e2a10-7b4c-4d8e-9a1f-5c2b3d4e6f02',
  budgetShift: '3f6e2a10-7b4c-4d8e-9a1f-5c2b3d4e6f03',
} as const;

type SeedEvent = Omit<IncomingEvent, 'seq' | 'kind' | 'at'> & { minutesAgo: number };

const days = (n: number) => n * 24 * 60;

function dailyLabels(count: number, now: Date): string[] {
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (count - 1 - i));
    return fmt.format(d);
  });
}

export function buildSeed(now: Date): SeedEvent[] {
  const labels = dailyLabels(14, now);
  const conversions = [6, 9, 8, 12, 11, 14, 13, 17, 15, 19, 18, 22, 21, 28];

  return [
    // Holiday bundles: completed goal
    {
      minutesAgo: days(9),
      type: 'goal_updated',
      threadId: THREADS.holiday,
      payload: { goalId: GOALS.holiday, status: 'completed', progress: { completed: 4, total: 4 }, metrics: { spend: 2410, impressions: 241800, clicks: 6120, conversions: 388 } },
      ui: {
        component: 'goal_summary',
        version: '1.0.0',
        props: { title: 'Holiday gift guide: test three bundle offers', status: 'completed', progress: 100, metrics: { spend: 2410, budget: 2500, currency: 'USD', impressions: 241800, clicks: 6120, conversions: 388 } },
      },
      fallbackText: 'Holiday gift guide test completed: 388 conversions for $2,410.',
    },
    {
      minutesAgo: days(9) - 5,
      type: 'message',
      threadId: THREADS.holiday,
      payload: { text: 'The test is complete. The **Trail-ready bundle** won clearly: it converted at 4.1% against 2.6% for the next best offer, at a cost per conversion of $5.12. I recommend making it the default holiday offer.', source: 'brain' },
      fallbackText: 'The Trail-ready bundle won the holiday offer test.',
    },
    {
      minutesAgo: days(9) - 6,
      type: 'message',
      threadId: THREADS.holiday,
      payload: {},
      ui: {
        component: 'metric_chart',
        version: '1.0.0',
        props: {
          title: 'Conversions by bundle',
          type: 'bar',
          data: [
            { label: 'Trail-ready', value: 201 },
            { label: 'Camp kitchen', value: 112 },
            { label: 'Cosy cabin', value: 75 },
          ],
          xAxis: 'Bundle',
          yAxis: 'Conversions',
        },
      },
      fallbackText: 'Conversions by bundle: Trail-ready 201, Camp kitchen 112, Cosy cabin 75.',
    },
    {
      minutesAgo: days(9) - 6,
      type: 'message',
      threadId: THREADS.holiday,
      payload: {},
      ui: { component: 'spend_bar', version: '1.0.0', props: { spent: 2410, budget: 2500, currency: 'USD', period: 'Final', showPercentage: true } },
      fallbackText: '$2,410 spent of $2,500 cap.',
    },

    // Trailhead 2 boot: active goal with live campaign reporting
    {
      minutesAgo: days(6),
      type: 'message',
      threadId: THREADS.boot,
      payload: { text: 'Find out whether UK hikers will buy the Trailhead 2 boot at $149. Keep total spend under $3,000.', source: 'user' },
      fallbackText: 'Goal brief for Trailhead 2.',
    },
    {
      minutesAgo: days(6) - 30,
      type: 'message',
      threadId: THREADS.boot,
      payload: { text: 'Your plan was approved and three ad variants are live on Meta and Google Search, targeting UK hikers aged 25–54. I will report results here every day.', source: 'brain' },
      fallbackText: 'Campaign launched.',
    },
    {
      minutesAgo: 190,
      type: 'alert',
      threadId: THREADS.boot,
      payload: { severity: 'info', title: 'Variant C paused by guardrail', message: 'Its cost per conversion reached 2.1× your $10 target, so it was paused automatically to protect your budget.' },
      ui: {
        component: 'alert',
        version: '1.0.0',
        props: { severity: 'info', title: 'Variant C paused by guardrail', message: 'Its cost per conversion reached 2.1× your $10 target, so it was paused automatically to protect your budget.' },
      },
      fallbackText: 'Variant C was paused by a guardrail.',
    },
    {
      minutesAgo: 95,
      type: 'message',
      threadId: THREADS.boot,
      payload: { text: 'Conversions are up 21% week on week. **Variant B (“Waterproof in any weather”)** is converting at 5.3%, well ahead of the others, so I have proposed moving more of the daily budget to it.', source: 'brain' },
      fallbackText: 'Variant B is the strongest performer.',
    },
    {
      minutesAgo: 94,
      type: 'message',
      threadId: THREADS.boot,
      payload: {},
      ui: {
        component: 'metric_chart',
        version: '1.0.0',
        props: { title: 'Daily conversions', type: 'area', data: labels.map((label, i) => ({ label, value: conversions[i] })), xAxis: 'Day', yAxis: 'Conversions' },
      },
      fallbackText: 'Daily conversions rose from 6 to 28 over 14 days.',
    },
    {
      minutesAgo: 94,
      type: 'message',
      threadId: THREADS.boot,
      payload: {},
      ui: {
        component: 'table',
        version: '1.0.0',
        props: {
          caption: 'Ad variant performance',
          sortable: true,
          headers: ['Variant', 'Channel', 'Status', 'Spend', 'Impressions', 'CTR', 'Conversions', 'Cost / conv.'],
          rows: [
            ['B · Waterproof in any weather', 'Meta', 'Live', '$812.40', '71,950', '3.4%', '118', '$6.88'],
            ['A · Built for the long trail', 'Meta', 'Live', '$604.10', '64,210', '2.6%', '61', '$9.90'],
            ['D · Search: waterproof boots', 'Google', 'Live', '$268.50', '18,640', '5.9%', '25', '$10.74'],
            ['C · Lighter than you think', 'Meta', 'Paused', '$155.00', '27,600', '1.2%', '9', '$17.22'],
          ],
        },
      },
      fallbackText: 'Ad variant performance table.',
    },
    {
      minutesAgo: 94,
      type: 'message',
      threadId: THREADS.boot,
      payload: {},
      ui: { component: 'spend_bar', version: '1.0.0', props: { spent: 1840, budget: 3000, currency: 'USD', period: 'Campaign to date', showPercentage: true } },
      fallbackText: '$1,840 spent of $3,000 cap.',
    },
    {
      minutesAgo: 60,
      type: 'goal_updated',
      threadId: THREADS.boot,
      payload: { goalId: GOALS.boot, status: 'active', progress: { completed: 5, total: 8 }, metrics: { spend: 1840, impressions: 182400, clicks: 4926, conversions: 213 } },
      ui: {
        component: 'goal_summary',
        version: '1.0.0',
        props: { title: 'Validate UK demand for the Trailhead 2 boot', status: 'active', progress: 63, metrics: { spend: 1840, budget: 3000, currency: 'USD', impressions: 182400, clicks: 4926, conversions: 213 } },
      },
      fallbackText: 'Trailhead 2: 63% complete, $1,840 of $3,000 spent.',
    },
    {
      minutesAgo: 40,
      type: 'status',
      threadId: THREADS.boot,
      payload: { state: 'executing', message: 'Optimising toward the best-performing variant', progress: { current: 5, total: 8 } },
      ui: { component: 'status_banner', version: '1.0.0', props: { status: 'executing', message: 'Optimising toward the best-performing variant', progress: 63 } },
      fallbackText: 'Optimising toward the best-performing variant.',
    },
    {
      minutesAgo: 12,
      type: 'ask',
      threadId: THREADS.boot,
      payload: {
        askId: ASKS.budgetShift,
        askType: 'action_approval',
        title: 'Move more daily budget to variant B',
        description: 'Variant B converts at twice the rate of variant A.',
        blocking: false,
        risk: 'medium',
        costEffect: { current: 120, proposed: 145, currency: 'USD', impact: '+$25 per day' },
        questions: [],
      },
      ui: {
        component: 'approval_card',
        version: '1.0.0',
        props: {
          title: 'Move more daily budget to variant B',
          description: 'Variant B converts at twice the rate of variant A. This keeps the campaign within its $3,000 cap.',
          action: 'Increase variant B daily budget',
          currentValue: '$40 / day',
          proposedValue: '$65 / day',
          risk: 'medium',
          costImpact: { current: 120, proposed: 145, currency: 'USD' },
        },
      },
      fallbackText: 'Approve moving variant B from $40 to $65 per day.',
    },

    // Ridgeline jacket: new goal waiting for a clarifying answer
    {
      minutesAgo: 8,
      type: 'goal_updated',
      threadId: THREADS.jacket,
      payload: { goalId: GOALS.jacket, status: 'active', progress: { completed: 0, total: 4 }, metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0 } },
      ui: {
        component: 'goal_summary',
        version: '1.0.0',
        props: { title: 'Spring launch: Ridgeline rain jacket', status: 'active', progress: 5, metrics: { spend: 0, budget: 5000, currency: 'USD' } },
      },
      fallbackText: 'Spring launch: Ridgeline rain jacket.',
    },
    {
      minutesAgo: 8,
      type: 'message',
      threadId: THREADS.jacket,
      payload: { text: 'Plan a spring launch for the Ridgeline rain jacket. Budget is $5,000, and we want pre-orders from existing customers first.', source: 'user' },
      fallbackText: 'Goal brief for the Ridgeline rain jacket.',
    },
    {
      minutesAgo: 7,
      type: 'message',
      threadId: THREADS.jacket,
      payload: { text: 'Thanks. I have reviewed last season’s sales and your customer lists. Before I draft the launch plan, I need one decision from you.', source: 'brain' },
      fallbackText: 'Proba needs one decision before drafting the plan.',
    },
    {
      minutesAgo: 6,
      type: 'ask',
      threadId: THREADS.jacket,
      payload: {
        askId: ASKS.audience,
        askType: 'clarify',
        title: 'Choose the first audience',
        description: 'This decides who sees the pre-order campaign first.',
        blocking: true,
        risk: 'low',
        questions: [{ id: 'audience', type: 'choice', label: 'Who should see the first wave of ads?' }],
      },
      ui: {
        component: 'question_choice',
        version: '1.0.0',
        props: {
          question: 'Who should see the first wave of ads?',
          options: [
            { value: 'active', label: 'Customers active in the last 90 days', description: 'About 12,500 people. Recommended: the highest expected pre-order rate.' },
            { value: 'all', label: 'All existing customers', description: 'About 48,000 people. Broader reach, with a lower expected conversion rate.' },
            { value: 'lookalike', label: 'New prospects similar to recent buyers', description: 'Reaches new customers. Best once pre-orders are under way.' },
          ],
        },
      },
      fallbackText: 'Who should see the first wave of ads?',
    },
  ];
}

export function launchPlanEvent(): Omit<IncomingEvent, 'seq' | 'kind' | 'at'> {
  return {
    type: 'ask',
    threadId: THREADS.jacket,
    payload: {
      askId: ASKS.launchPlan,
      askType: 'plan_approval',
      title: 'Ridgeline spring launch plan',
      description: 'Four steps, starting with your most engaged customers.',
      blocking: true,
      risk: 'medium',
      questions: [],
    },
    ui: {
      component: 'plan_card',
      version: '1.0.0',
      props: {
        title: 'Ridgeline spring launch plan',
        description: 'Four steps, starting with your most engaged customers. Nothing goes live until you approve it.',
        steps: [
          { id: 's1', title: 'Produce ad creative', description: 'Three variants: waterproofing, packability and price.', status: 'pending', estimatedCost: 450 },
          { id: 's2', title: 'Build the launch audience', description: 'Customers active in the last 90 days, synced to Meta and Google.', status: 'pending', estimatedCost: 0 },
          { id: 's3', title: 'Run a seven-day test', description: '$150 per day, split evenly across the three variants.', status: 'pending', estimatedCost: 1050 },
          { id: 's4', title: 'Scale the winning variant', description: 'Move the remaining budget to the best performer, subject to your approval.', status: 'pending', estimatedCost: 3500 },
        ],
        totalEstimatedCost: 5000,
        currency: 'USD',
      },
      actions: [
        { id: 'approve', label: 'Approve plan', style: 'primary', command: { type: 'approve_plan', payload: { planId: ASKS.launchPlan, approved: true } } },
        { id: 'edit', label: 'Request changes', style: 'default' },
        { id: 'reject', label: 'Decline', style: 'danger' },
      ],
    },
    fallbackText: 'Ridgeline spring launch plan: 4 steps, estimated cost $5,000.',
  };
}
