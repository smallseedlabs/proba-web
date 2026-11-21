import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionsClient } from '../../lib/actions/client';
import { ActionsProvider } from '../../state/actions';
import { GuardrailRejection } from './GuardrailRejection';
import { PostCreativeCard } from './PostCreativeCard';

describe('H3-06 GuardrailRejection and spend-gate cost visibility', () => {
  it('renders layer, field, repair state, and reason on GuardrailRejection', () => {
    render(
      <GuardrailRejection
        verdict={{
          approved: false,
          layer: 'deterministic',
          field: 'landingPageUrl',
          reason: 'URL does not match operator destination',
          repairAttempt: 1,
          needsHuman: false,
        }}
      />
    );
    const box = screen.getByTestId('guardrail-rejection');
    expect(box).toHaveTextContent('Deterministic check');
    expect(box).toHaveTextContent('landingPageUrl');
    expect(box).toHaveTextContent('Repair attempt 1');
    expect(box).toHaveTextContent('URL does not match operator destination');
  });

  it('shows spend-gate justification and cost on PostCreativeCard', async () => {
    const client = {
      getCreative: vi.fn(async () => ({
        approvedAt: null,
        creative: { type: 'IMAGE', headline: 'Hello', body: 'World', mediaUrl: 'https://example.com/a.png' },
        spendGate: { justification: 'no_usable_site_image', estimatedCostUsd: 0.08 },
      })),
    } as unknown as ActionsClient;

    render(
      <ActionsProvider client={client}>
        <PostCreativeCard goalId="g1" />
      </ActionsProvider>
    );

    const info = await screen.findByTestId('spend-gate-info');
    expect(info).toHaveTextContent('no_usable_site_image');
    expect(info).toHaveTextContent('$0.08');
  });
});
