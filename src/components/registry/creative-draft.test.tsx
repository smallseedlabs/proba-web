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
