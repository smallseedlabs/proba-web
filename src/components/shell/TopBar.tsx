import { Building2, ChevronsUpDown, CirclePause, CirclePlay, LogOut, Menu as MenuIcon, OctagonX, Settings, SlidersHorizontal, Wifi, WifiOff, Zap } from 'lucide-react';
import type { Session, Workspace } from '../../lib/auth';
import type { ConnectionStatus } from '../../lib/transport';
import { cn } from '../../lib/utils/cn';
import { initials } from '../../lib/utils/format';
import { useUIMode } from '../../state/ui-mode';
import type { OperationsState } from '../../state/workspace';
import { LogoMark } from '../brand/Logo';
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
  const { mode, setMode, canSwitchMode } = useUIMode();
  const isAuto = mode === 'auto';
  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b px-4 lg:px-6',
        isAuto ? 'border-[#E2E8F0] bg-white text-[#0B0D12]' : 'bg-surface'
      )}
    >
      {!isAuto && (
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenNav} aria-label="Open navigation">
          <MenuIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}

      {isAuto ? (
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-section font-bold tracking-tight text-[#0B0D12]">Proba</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F5F7FA] px-2.5 py-0.5 text-[11px] font-semibold text-[#0B0D12]">
            <span className="h-2 w-2 rounded-full bg-[#84CC16]" aria-hidden="true" />
            Brand Growth Studio
          </span>
        </div>
      ) : (
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
      )}

      <div className="ml-auto flex items-center gap-2">
        {canSwitchMode && (
          <div
            role="radiogroup"
            aria-label="Workspace mode"
            className={cn(
              'hidden items-center rounded-lg border p-0.5 sm:inline-flex',
              isAuto ? 'border-[#E2E8F0] bg-[#F5F7FA]' : 'bg-background'
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'auto'}
              onClick={() => setMode('auto')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-caption font-semibold transition-colors',
                mode === 'auto'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="h-3 w-3" aria-hidden="true" />
              <span className="hidden lg:inline">1-Click Auto</span>
              <span className="lg:hidden">Auto</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'controlled'}
              onClick={() => setMode('controlled')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-caption font-semibold transition-colors',
                mode === 'controlled'
                  ? 'border bg-surface text-foreground shadow-sm'
                  : 'text-slate-600 hover:text-[#0B0D12]'
              )}
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>Controlled</span>
            </button>
          </div>
        )}
        {!isAuto && (
          <>
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
          </>
        )}

        <Menu
          menuLabel="Account"
          triggerClassName={cn(
            'gap-2 rounded-full p-0.5 md:rounded-md md:py-1 md:pl-1 md:pr-2',
            isAuto ? 'hover:bg-[#F5F7FA]' : 'hover:bg-muted'
          )}
          trigger={
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B0D12] text-caption font-semibold text-white" aria-hidden="true">
                {initials(session.user.name)}
              </span>
              <span className="sr-only text-left xl:not-sr-only">
                <span className={cn('block max-w-[160px] truncate text-body font-semibold leading-tight', isAuto ? 'text-[#0B0D12]' : 'text-foreground')}>
                  {session.user.name}
                </span>
                {session.user.role && (
                  <>
                    {' '}
                    <span className="block text-caption leading-tight text-muted-foreground">
                      {session.user.role === 'instant_managed'
                        ? 'Managed Growth'
                        : session.user.role === 'instant_byo'
                          ? 'Connected Accounts'
                          : session.user.role === 'operator'
                            ? 'Growth Lead'
                            : session.user.role}
                    </span>
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
