import { Building2, ChevronsUpDown, CirclePause, CirclePlay, LogOut, Menu as MenuIcon, OctagonX, Settings, Wifi, WifiOff } from 'lucide-react';
import type { Session, Workspace } from '../../lib/auth';
import type { ConnectionStatus } from '../../lib/transport';
import { cn } from '../../lib/utils/cn';
import { initials } from '../../lib/utils/format';
import type { OperationsState } from '../../state/workspace';
import { Button } from '../ui/button';
import { Menu } from '../ui/menu';

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const live = status === 'open';
  const label = live ? 'Live' : status === 'reconnecting' ? 'Reconnecting' : status === 'connecting' ? 'Connecting' : 'Offline';
  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium md:inline-flex',
        live ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
      )}
    >
      {live ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>
        <span className="sr-only">Connection status: </span>
        {label}
      </span>
    </span>
  );
}

export function TopBar({
  session,
  workspace,
  onSwitchWorkspace,
  onSignOut,
  onOpenSettings,
  onOpenNav,
  connection,
  operations,
  pendingControl,
  onPauseToggle,
  onEmergencyStop,
}: {
  session: Session;
  workspace: Workspace;
  onSwitchWorkspace: (id: string) => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onOpenNav: () => void;
  connection: ConnectionStatus;
  operations: OperationsState;
  pendingControl: string | null;
  onPauseToggle: () => void;
  onEmergencyStop: () => void;
}) {
  const paused = operations !== 'running';
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-surface px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenNav} aria-label="Open navigation">
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </Button>

      <Menu
        align="start"
        menuLabel="Switch workspace"
        triggerClassName="gap-2.5 rounded-md border bg-surface px-2.5 py-1.5 hover:bg-muted"
        trigger={
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-subtle text-primary" aria-hidden="true">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="sr-only text-left sm:not-sr-only">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Workspace</span>{' '}
              <span className="block max-w-[180px] truncate text-body font-semibold leading-tight text-foreground">{workspace.name}</span>
            </span>
            <span className="sr-only">, switch workspace</span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </>
        }
        sections={[
          {
            label: 'Switch workspace',
            items: session.workspaces.map((ws) => ({
              id: ws.id,
              label: ws.name,
              checked: ws.id === workspace.id,
              icon: <Building2 className="h-4 w-4" />,
              onSelect: () => onSwitchWorkspace(ws.id),
            })),
          },
        ]}
      />

      <div className="ml-auto flex items-center gap-2">
        <ConnectionIndicator status={connection} />
        <Button
          variant="outline"
          onClick={onPauseToggle}
          loading={pendingControl === 'pause' || pendingControl === 'resume'}
          aria-label={paused ? 'Resume all activity' : 'Pause all activity'}
        >
          {pendingControl !== 'pause' && pendingControl !== 'resume' &&
            (paused ? <CirclePlay className="h-4 w-4" aria-hidden="true" /> : <CirclePause className="h-4 w-4" aria-hidden="true" />)}
          <span className="hidden lg:inline">{paused ? 'Resume all' : 'Pause all'}</span>
        </Button>
        <Button
          variant="danger"
          onClick={onEmergencyStop}
          disabled={operations === 'stopped'}
          loading={pendingControl === 'kill'}
          aria-label="Emergency stop: halt all campaigns"
          aria-haspopup="dialog"
        >
          {pendingControl !== 'kill' && <OctagonX className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden lg:inline">Emergency stop</span>
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border md:block" aria-hidden="true" />

        <Menu
          menuLabel="Account"
          triggerClassName="gap-2 rounded-full p-0.5 hover:bg-muted md:rounded-md md:py-1 md:pl-1 md:pr-2"
          trigger={
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-caption font-semibold text-white" aria-hidden="true">
                {initials(session.user.name)}
              </span>
              <span className="sr-only text-left xl:not-sr-only">
                <span className="block max-w-[160px] truncate text-body font-medium leading-tight text-foreground">{session.user.name}</span>
                {session.user.role && (
                  <>
                    {' '}
                    <span className="block text-caption leading-tight text-muted-foreground">{session.user.role}</span>
                  </>
                )}
              </span>
              <span className="sr-only">, account menu</span>
            </>
          }
          header={
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-foreground">{session.user.name}</p>
              <p className="truncate text-caption text-muted-foreground">{session.user.email}</p>
            </div>
          }
          sections={[
            { items: [{ id: 'settings', label: 'Account settings', icon: <Settings className="h-4 w-4" />, onSelect: onOpenSettings }] },
            { items: [{ id: 'signout', label: 'Sign out', icon: <LogOut className="h-4 w-4" />, onSelect: onSignOut }] },
          ]}
        />
      </div>
    </header>
  );
}
