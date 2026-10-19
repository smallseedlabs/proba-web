import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionStore, type Session } from './lib/auth';
import { useConfig } from './lib/config';
import { createServices, type Services } from './lib/services';
import { SignInPage } from './components/auth/SignInPage';
import { AppShell } from './components/shell/AppShell';
import { LogoMark } from './components/brand/Logo';
import { Spinner } from './components/ui/feedback';
import { WorkspaceProvider } from './state/workspace';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <LogoMark className="h-10 w-10" />
      <Spinner label="Loading Proba" />
    </div>
  );
}

function SignedInApp({
  services,
  session,
  onSignOut,
  onSessionExpired,
}: {
  services: Services;
  session: Session;
  onSignOut: () => void;
  onSessionExpired: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState(session.workspaces[0]?.id ?? 'default');
  const workspace = session.workspaces.find((w) => w.id === workspaceId) ?? session.workspaces[0] ?? { id: 'default', name: 'My workspace' };
  const transport = useMemo(() => services.createTransport(session, workspace.id), [services, session, workspace.id]);

  return (
    <WorkspaceProvider key={workspace.id} transport={transport} onSessionExpired={onSessionExpired}>
      <AppShell session={session} workspace={workspace} onSwitchWorkspace={setWorkspaceId} onSignOut={onSignOut} />
    </WorkspaceProvider>
  );
}

export default function App() {
  const config = useConfig();
  const [services, setServices] = useState<Services | null>(null);
  const [session, setSession] = useState<Session | null>(() => sessionStore.load());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createServices(config).then((s) => {
      if (!cancelled) setServices(s);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const handleSignedIn = useCallback((next: Session) => {
    sessionStore.save(next);
    setNotice(null);
    setSession(next);
  }, []);

  const handleSignOut = useCallback(() => {
    if (session && services) void services.auth.signOut(session);
    sessionStore.clear();
    setSession(null);
    setNotice('You have been signed out.');
    window.location.hash = '';
  }, [session, services]);

  const handleExpired = useCallback(() => {
    sessionStore.clear();
    setSession(null);
    setNotice('Your session has expired. Please sign in again.');
  }, []);

  if (!services) return <Splash />;

  if (!session) {
    return <SignInPage auth={services.auth} onSignedIn={handleSignedIn} notice={notice} />;
  }

  return <SignedInApp services={services} session={session} onSignOut={handleSignOut} onSessionExpired={handleExpired} />;
}
