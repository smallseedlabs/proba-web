import { useEffect, useMemo, useRef, useState } from 'react';
import { OctagonX, WifiOff, X } from 'lucide-react';
import type { Session, Workspace } from '../../lib/auth';
import { useRoute } from '../../lib/router';
import { useGoals, useOpenAsks } from '../../state/hooks';
import { useWorkspace } from '../../state/workspace';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Callout } from '../ui/feedback';
import { ActivityView } from '../views/ActivityView';
import { ApprovalsView } from '../views/ApprovalsView';
import { CampaignsView } from '../views/CampaignsView';
import { GoalsView } from '../views/GoalsView';
import { SettingsView } from '../views/SettingsView';
import { NAV_ITEMS } from './nav';
import { Sidebar, type NavItem } from './Sidebar';
import { TopBar } from './TopBar';

const TITLES: Record<string, string> = {
  goals: 'Goals',
  approvals: 'Approvals',
  activity: 'Activity',
  campaigns: 'Campaigns',
  settings: 'Settings',
};

export function AppShell({
  session,
  workspace,
  onSwitchWorkspace,
  onSignOut,
}: {
  session: Session;
  workspace: Workspace;
  onSwitchWorkspace: (id: string) => void;
  onSignOut: () => void;
}) {
  const [route, navigate] = useRoute();
  const { state, control } = useWorkspace();
  const openAsks = useOpenAsks();
  const goals = useGoals();
  const [confirmStop, setConfirmStop] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = `${TITLES[route.section]} · ${workspace.name} · Proba`;
  }, [route.section, workspace.name]);

  const items: NavItem[] = useMemo(
    () =>
      NAV_ITEMS.map((item) =>
        item.section === 'approvals'
          ? { ...item, count: openAsks.length, countLabel: 'awaiting your decision' }
          : item.section === 'goals'
            ? { ...item, count: goals.filter((g) => g.status === 'active').length, countLabel: 'active' }
            : item
      ),
    [openAsks.length, goals]
  );

  const stop = async () => {
    const ok = await control('kill');
    if (ok) setConfirmStop(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <Sidebar current={route.section} items={items} className="hidden w-64 shrink-0 lg:flex" />
      <Sidebar current={route.section} items={items} compact className="hidden w-[72px] shrink-0 md:flex lg:hidden" />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="relative h-full w-72">
            <Sidebar current={route.section} items={items} onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-sidebar-muted hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          session={session}
          workspace={workspace}
          onSwitchWorkspace={onSwitchWorkspace}
          onSignOut={onSignOut}
          onOpenSettings={() => navigate({ section: 'settings' })}
          onOpenNav={() => setDrawerOpen(true)}
          connection={state.connection}
          operations={state.operations}
          pendingControl={state.pendingControl}
          onPauseToggle={() => control(state.operations === 'running' ? 'pause' : 'resume')}
          onEmergencyStop={() => setConfirmStop(true)}
        />

        <div aria-live="polite" className="empty:hidden">
          {state.connection === 'reconnecting' && (
            <div className="border-b border-warning/30 bg-warning-subtle px-4 py-2 lg:px-6">
              <p className="flex items-center gap-2 text-body text-foreground">
                <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">Connection lost. Reconnecting…</strong> Updates will resume automatically. Your approvals and spend controls are unaffected.
                </span>
              </p>
            </div>
          )}
          {state.operations === 'paused' && (
            <div className="border-b px-4 py-3 lg:px-6">
              <Callout
                tone="warning"
                title="All activity is paused"
                actions={
                  <Button size="sm" variant="outline" onClick={() => control('resume')} loading={state.pendingControl === 'resume'}>
                    Resume all
                  </Button>
                }
              >
                Proba will not launch, change or spend on any campaign until you resume.
              </Callout>
            </div>
          )}
          {state.operations === 'stopped' && (
            <div className="border-b px-4 py-3 lg:px-6">
              <Callout
                tone="danger"
                title="Emergency stop engaged"
                actions={
                  <Button size="sm" variant="outline" onClick={() => control('resume')} loading={state.pendingControl === 'resume'}>
                    Resume operations
                  </Button>
                }
              >
                Every campaign in {workspace.name} has been halted and no further spend will occur.
              </Callout>
            </div>
          )}
        </div>

        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">
          {route.section === 'goals' && <GoalsView selectedId={route.id} session={session} />}
          {route.section === 'approvals' && <ApprovalsView />}
          {route.section === 'activity' && <ActivityView />}
          {route.section === 'campaigns' && <CampaignsView selectedId={route.id} />}
          {route.section === 'settings' && <SettingsView session={session} workspace={workspace} onSignOut={onSignOut} />}
        </main>
      </div>

      <Dialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        role="alertdialog"
        tone="danger"
        size="sm"
        icon={<OctagonX className="h-5 w-5" />}
        title="Stop all campaigns now?"
        description={
          <>
            This immediately halts every live campaign in <strong className="font-semibold text-foreground">{workspace.name}</strong> and blocks all
            new spend on every channel. You can resume operations afterwards.
          </>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmStop(false)} data-autofocus>
              Cancel
            </Button>
            <Button variant="danger" onClick={stop} loading={state.pendingControl === 'kill'}>
              Stop all campaigns
            </Button>
          </>
        }
      />
    </div>
  );
}
