import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plug } from 'lucide-react';
import { ActionsError, type ConnectionsState, type PlatformConnection } from '../../lib/actions/client';
import { takePendingOAuthCallback } from '../../lib/connections/callback';
import { formatDateTime } from '../../lib/utils/format';
import { useActionsClient } from '../../state/actions';
import { Badge, type Tone } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Dialog } from '../ui/dialog';
import { Callout, EmptyState, Spinner } from '../ui/feedback';
import { Label, NativeSelect } from '../ui/field';
import { Page, PageHeader } from './common';

/** Providers the owner can connect today. Others are listed as coming soon. */
const ENABLED_PROVIDERS = new Set(['reddit']);

const STATUS: Record<PlatformConnection['status'], { label: string; tone: Tone }> = {
  not_connected: { label: 'Not connected', tone: 'neutral' },
  pending_account: { label: 'Choose an ad account', tone: 'warning' },
  connected: { label: 'Connected', tone: 'success' },
  needs_reconnect: { label: 'Reconnect needed', tone: 'danger' },
};

function errorText(error: unknown): string {
  return error instanceof ActionsError ? error.message : 'Something went wrong. Try again.';
}

function AccountPicker({
  connection,
  busy,
  onSelect,
}: {
  connection: PlatformConnection;
  busy: boolean;
  onSelect: (accountId: string) => void;
}) {
  const id = useId();
  const accounts = connection.accounts ?? [];
  const [choice, setChoice] = useState(connection.accountId ?? accounts[0]?.id ?? '');
  if (!connection.connectedByMe) {
    return <p className="text-body text-muted-foreground">The member who connected this platform chooses the ad account.</p>;
  }
  if (accounts.length === 0) {
    return <p className="text-body text-muted-foreground">No ad accounts were found on this login. Check the account’s access on the platform, then reconnect.</p>;
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[16rem] flex-1">
        <Label htmlFor={`${id}-account`}>Ad account</Label>
        <NativeSelect id={`${id}-account`} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.id}
              {a.currency ? `, ${a.currency}` : ''}
              {a.businessName ? `, ${a.businessName}` : ''})
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button size="sm" loading={busy} disabled={!choice || choice === connection.accountId} onClick={() => onSelect(choice)}>
        Use this account
      </Button>
    </div>
  );
}

function ProviderCard({
  connection,
  enabled,
  busy,
  onConnect,
  onSelect,
  onDisconnect,
}: {
  connection: PlatformConnection;
  enabled: boolean;
  busy: string | null;
  onConnect: () => void;
  onSelect: (accountId: string) => void;
  onDisconnect: () => void;
}) {
  const live = enabled && connection.available;
  const status = STATUS[connection.status];
  const connected = connection.status !== 'not_connected';
  return (
    <Card>
      <CardHeader
        title={connection.displayName}
        titleAs="h2"
        description={
          !enabled
            ? 'Coming soon.'
            : !connection.available
              ? 'Not set up on this Hub yet: the Proba app credentials for this platform are missing.'
              : 'Sign in on the platform to let Proba read and manage campaigns on one ad account.'
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={enabled ? status.tone : 'neutral'} dot>
            {enabled ? status.label : 'Coming soon'}
          </Badge>
          {connection.accountId && (
            <span className="text-body text-muted-foreground">
              Account: {connection.accountName ? `${connection.accountName} (${connection.accountId})` : connection.accountId}
            </span>
          )}
          {connection.connectedAt && (
            <span className="text-caption text-muted-foreground">Connected {formatDateTime(connection.connectedAt)}</span>
          )}
        </div>
        {connection.status === 'needs_reconnect' && (
          <Callout tone="danger">The platform stopped accepting this login. Reconnect to resume campaign actions and reviews.</Callout>
        )}
        {live && (connection.status === 'pending_account' || (connection.status === 'connected' && (connection.accounts?.length ?? 0) > 1)) && (
          <AccountPicker connection={connection} busy={busy === 'select'} onSelect={onSelect} />
        )}
        {live && (
          <div className="flex flex-wrap gap-2">
            {(!connected || connection.status === 'needs_reconnect') && (
              <Button size="sm" loading={busy === 'connect'} onClick={onConnect}>
                {connected ? 'Reconnect' : `Connect ${connection.displayName}`}
              </Button>
            )}
            {connected && connection.connectedByMe !== false && (
              <Button size="sm" variant="outline" loading={busy === 'disconnect'} onClick={onDisconnect}>
                Disconnect
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function MarketingView() {
  const client = useActionsClient();
  const [state, setState] = useState<ConnectionsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<{ provider: string; op: string } | null>(null);
  const [confirm, setConfirm] = useState<PlatformConnection | null>(null);
  const callbackHandled = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!client) return;
      try {
        setState(await client.listConnections(signal));
        setLoadError(null);
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(errorText(error));
      }
    },
    [client]
  );

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    const pending = callbackHandled.current ? null : takePendingOAuthCallback();
    callbackHandled.current = true;
    void (async () => {
      if (pending) {
        setBusy({ provider: pending.provider, op: 'callback' });
        try {
          const connection = await client.completeConnection(pending.provider, {
            state: pending.state,
            ...(pending.code ? { code: pending.code } : {}),
            ...(pending.error ? { error: pending.error } : {}),
          });
          setNotice({
            tone: 'success',
            text:
              connection.status === 'pending_account'
                ? `${connection.displayName} is connected. Choose the ad account Proba should use.`
                : `${connection.displayName} is connected.`,
          });
        } catch (error) {
          setNotice({ tone: 'danger', text: errorText(error) });
        } finally {
          setBusy(null);
        }
      }
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [client, load]);

  const run = async (provider: string, op: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy({ provider, op });
    setNotice(null);
    try {
      await fn();
      if (success) setNotice({ tone: 'success', text: success });
      await load();
    } catch (error) {
      setNotice({ tone: 'danger', text: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  const connect = async (provider: string) => {
    if (!client) return;
    setBusy({ provider, op: 'connect' });
    setNotice(null);
    try {
      const { authorizeUrl } = await client.startConnection(provider);
      window.location.assign(authorizeUrl);
    } catch (error) {
      setNotice({ tone: 'danger', text: errorText(error) });
      setBusy(null);
    }
  };

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Connect the ad platforms Proba may act on. You sign in on the platform; Proba keeps the login on the Hub only, and every campaign action is recorded against the connection and the person who approved it."
      />
      {!client && (
        <EmptyState icon={<Plug className="h-5 w-5" />} title="Not available here" description="Sign in to a Hub to manage ad platform connections." />
      )}
      {notice && (
        <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Callout>
      )}
      {loadError && <Callout tone="danger" role="alert">{loadError}</Callout>}
      {client && !state && !loadError && <Spinner label="Loading connections" />}
      {busy?.op === 'callback' && <Spinner label="Finishing the platform sign-in" />}
      {state && !state.enabled && (
        <Callout tone="info" title="Connections are off on this Hub">
          The Hub needs a connections key and the platform app credentials. See the local testing guide.
        </Callout>
      )}
      {state && (
        <div className="grid gap-4 md:grid-cols-2">
          {state.connections.map((connection) => (
            <ProviderCard
              key={connection.provider}
              connection={connection}
              enabled={state.enabled && ENABLED_PROVIDERS.has(connection.provider)}
              busy={busy?.provider === connection.provider ? busy.op : null}
              onConnect={() => void connect(connection.provider)}
              onSelect={(accountId) =>
                void run(
                  connection.provider,
                  'select',
                  () => client!.selectConnectionAccount(connection.provider, accountId),
                  `${connection.displayName} will use ad account ${accountId}.`
                )
              }
              onDisconnect={() => setConfirm(connection)}
            />
          ))}
        </div>
      )}
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        role="alertdialog"
        tone="danger"
        size="sm"
        title={confirm ? `Disconnect ${confirm.displayName}?` : ''}
        description="Proba revokes its access on the platform. Campaign actions and reviews for this platform stop until someone connects again. Campaigns already running on the platform are not paused."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c && client) void run(c.provider, 'disconnect', () => client.disconnectConnection(c.provider), `${c.displayName} is disconnected.`);
              }}
            >
              Disconnect
            </Button>
          </>
        }
      />
    </Page>
  );
}
