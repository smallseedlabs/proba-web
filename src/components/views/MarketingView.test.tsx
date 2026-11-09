import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ActionsClient, ConnectionsState, PlatformConnection } from '../../lib/actions/client';
import { ActionsProvider } from '../../state/actions';
import { ToastProvider } from '../ui/toast';
import { MarketingView } from './MarketingView';

const base = (provider: string, displayName: string, extra: Partial<PlatformConnection> = {}): PlatformConnection => ({
  provider,
  displayName,
  available: provider === 'reddit',
  status: 'not_connected',
  ...extra,
});

function state(reddit: Partial<PlatformConnection> = {}): ConnectionsState {
  return {
    enabled: true,
    workspaceId: 'seedbed',
    connections: [base('reddit', 'Reddit', reddit), base('meta', 'Meta'), base('google', 'Google Ads')],
  };
}

function client(overrides: Partial<ActionsClient> = {}): ActionsClient {
  return {
    listConnections: vi.fn(async () => state()),
    startConnection: vi.fn(async () => ({ authorizeUrl: 'https://oauth.example.test/authorize?state=s', expiresAt: '' })),
    completeConnection: vi.fn(),
    selectConnectionAccount: vi.fn(),
    disconnectConnection: vi.fn(),
    ...overrides,
  } as unknown as ActionsClient;
}

function renderView(c: ActionsClient | null) {
  render(
    <ToastProvider>
      <ActionsProvider client={c}>
        <MarketingView />
      </ActionsProvider>
    </ToastProvider>
  );
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('MarketingView', () => {
  it('lists providers with only Reddit connectable and sends the browser to the provider sign-in', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const c = client();
    renderView(c);
    const connect = await screen.findByRole('button', { name: 'Connect Reddit' });
    expect(screen.getAllByText('Coming soon').length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Connect Meta' })).toBeNull();
    fireEvent.click(connect);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://oauth.example.test/authorize?state=s'));
    expect(c.startConnection).toHaveBeenCalledWith('reddit');
  });

  it('completes a pending callback once, then lets the connector pick the ad account', async () => {
    window.sessionStorage.setItem('proba.oauthCallback', JSON.stringify({ provider: 'reddit', state: 's1', code: 'c1' }));
    const pending = state({
      status: 'pending_account',
      connectedByMe: true,
      accounts: [
        { id: 'a2_one', name: 'One' },
        { id: 'a2_two', name: 'Two', currency: 'USD' },
      ],
    }).connections[0]!;
    const c = client({
      completeConnection: vi.fn(async () => pending),
      listConnections: vi.fn(async () => state(pending)),
      selectConnectionAccount: vi.fn(async () => ({ ...pending, status: 'connected' as const, accountId: 'a2_two' })),
    });
    renderView(c);
    expect(await screen.findByText(/Choose the ad account Proba should use/)).toBeInTheDocument();
    expect(c.completeConnection).toHaveBeenCalledTimes(1);
    expect(c.completeConnection).toHaveBeenCalledWith('reddit', { state: 's1', code: 'c1' });
    expect(window.sessionStorage.getItem('proba.oauthCallback')).toBeNull();
    fireEvent.change(await screen.findByLabelText('Ad account'), { target: { value: 'a2_two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this account' }));
    await waitFor(() => expect(c.selectConnectionAccount).toHaveBeenCalledWith('reddit', 'a2_two'));
  });

  it('disconnects only after confirming', async () => {
    const connected = { status: 'connected' as const, connectedByMe: true, accountId: 'a2_one', accountName: 'One' };
    const c = client({
      listConnections: vi.fn(async () => state(connected)),
      disconnectConnection: vi.fn(async () => base('reddit', 'Reddit')),
    });
    renderView(c);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(c.disconnectConnection).not.toHaveBeenCalled();
    const buttons = await screen.findAllByRole('button', { name: 'Disconnect' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(c.disconnectConnection).toHaveBeenCalledWith('reddit'));
  });

  it('explains when connections are off on the Hub', async () => {
    renderView(client({ listConnections: vi.fn(async () => ({ ...state(), enabled: false })) }));
    expect(await screen.findByText('Connections are off on this Hub')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Reddit' })).toBeNull();
  });
});
