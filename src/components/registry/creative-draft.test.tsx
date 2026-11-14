import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComponentRenderer } from './index';

const ui = {
  component: 'approval_card',
  version: '1.0.0',
  props: {
    title: 'Review the Reddit post Proba drafted',
    risk: 'medium',
    creativeDraft: {
      type: 'TEXT',
      headline: 'Waterproof boots for muddy UK trails',
      body: 'Light, grippy and dry on wet ground.',
      rationale: 'Practical angle',
      claims: [{ text: 'light', findingId: 'f1' }],
      landingPageUrl: 'https://example.com/offer',
    },
  },
} as never;

describe('CreativeDraftCard', () => {
  it('shows the editable draft, the operator page and claims; approving as shown sends no values', () => {
    const onAction = vi.fn();
    render(<ComponentRenderer fallbackText="draft" ui={ui} onAction={onAction} />);
    expect(screen.getByLabelText(/Headline/)).toHaveValue('Waterproof boots for muddy UK trails');
    expect(screen.getByText('https://example.com/offer')).toBeInTheDocument();
    expect(screen.getByText(/\(f1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve copy' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve' });
  });

  it('sends edited copy with approve', () => {
    const onAction = vi.fn();
    render(<ComponentRenderer fallbackText="draft" ui={ui} onAction={onAction} />);
    fireEvent.change(screen.getByLabelText(/Post text/), { target: { value: 'My own words.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save my edits and approve' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { headline: 'Waterproof boots for muddy UK trails', body: 'My own words.' } });
  });

  it('blocks an empty headline and rejects on request', () => {
    const onAction = vi.fn();
    render(<ComponentRenderer fallbackText="draft" ui={ui} onAction={onAction} />);
    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save my edits and approve' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText(/headline needs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'reject' });
  });

  it('a plain approval card is unchanged', () => {
    render(<ComponentRenderer fallbackText="card" ui={{ component: 'approval_card', version: '1.0.0', props: { title: 'Tool: page.attach_user_page' } } as never} />);
    expect(screen.getByText('Tool: page.attach_user_page')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Headline/)).toBeNull();
  });
});

describe('plan card', () => {
  const planUi = {
    component: 'approval_card',
    version: '1.0.0',
    props: {
      title: 'Review the campaign plan Proba drafted',
      creativeDraft: { type: 'TEXT', headline: 'Boots', body: 'Dry feet.', landingPageUrl: 'https://example.com/offer' },
      targeting: { communities: ['UKhiking'], geolocations: ['GB'] },
      plan: { platform: 'reddit', successMetric: 'clicks', successTarget: 200, durationDays: 14, reasons: { successMetric: 'Chose clicks because the page has no sign-up form.' } },
    },
  } as never;

  it('shows the chosen defaults with reasons and approves the plan as is', () => {
    const onAction = vi.fn();
    render(<ComponentRenderer fallbackText="plan" ui={planUi} onAction={onAction} />);
    expect(screen.getByText('Chose clicks because the page has no sign-up form.')).toBeInTheDocument();
    expect(screen.getByLabelText('Subreddits')).toHaveValue('UKhiking');
    expect(screen.getByText(/GB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve' });
  });

  it('sends overrides for subreddits and the success metric', () => {
    const onAction = vi.fn();
    render(<ComponentRenderer fallbackText="plan" ui={planUi} onAction={onAction} />);
    fireEvent.change(screen.getByLabelText('Subreddits'), { target: { value: 'hiking, camping' } });
    fireEvent.change(screen.getByLabelText('Success metric'), { target: { value: 'ctr' } });
    fireEvent.change(screen.getByLabelText(/Target/), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save my edits and approve' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { communities: 'hiking, camping', successMetric: 'ctr', successTarget: '1.5' } });
  });
});
