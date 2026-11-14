import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ActionsClient } from '../../lib/actions/client';
import { ActionsProvider } from '../../state/actions';
import { PostCreativeCard } from './PostCreativeCard';

function client(): ActionsClient {
  return {
    getCreative: vi.fn(async () => ({ creative: null, targeting: null, approvedAt: null })),
    saveCreative: vi.fn(async () => ({ creative: null, targeting: null, approvedAt: '2026-11-09T12:00:00.000Z' })),
  } as unknown as ActionsClient;
}

describe('PostCreativeCard', () => {
  it('starts empty, requires a public https image address, and saves exactly what was typed', async () => {
    const c = client();
    render(
      <ActionsProvider client={c}>
        <PostCreativeCard goalId="g1" />
      </ActionsProvider>
    );
    await waitFor(() => expect(c.getCreative).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Post type/), { target: { value: 'IMAGE' } });
    const media = screen.getByLabelText(/Image address/) as HTMLInputElement;
    expect(media.value).toBe('');
    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: 'My headline' } });
    fireEvent.change(media, { target: { value: 'http://127.0.0.1/a.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve post' }));
    expect(await screen.findByText(/public https address/)).toBeInTheDocument();
    expect(c.saveCreative).not.toHaveBeenCalled();

    fireEvent.change(media, { target: { value: 'https://images.operator-entered.example/a.png' } });
    fireEvent.change(screen.getByLabelText(/Subreddits/), { target: { value: 'r/one, r/two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve post' }));
    await waitFor(() =>
      expect(c.saveCreative).toHaveBeenCalledWith(
        'g1',
        { type: 'IMAGE', headline: 'My headline', mediaUrl: 'https://images.operator-entered.example/a.png' },
        { communities: ['one', 'two'] }
      )
    );
  });

  it('renders nothing without a Hub client', () => {
    const { container } = render(<PostCreativeCard goalId="g1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
