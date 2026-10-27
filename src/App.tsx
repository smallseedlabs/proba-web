import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_ERROR_MESSAGES, sessionStore, type Session } from './lib/auth';
import { useConfig } from './lib/config';
import { createServices, type Services } from './lib/services';
import { SignInPage } from './components/auth/SignInPage';
import { AppShell } from './components/shell/AppShell';
import { LogoMark } from './components/brand/Logo';
import { Spinner } from './components/ui/feedback';
import { AnalyticsProvider } from './state/analytics';
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
  const [workspaceId, setWorkspaceId] = useState(session.workspaces[0]?.id ?? 'seedbed');
  const workspace = session.workspaces.find((w) => w.id === workspaceId) ?? session.workspaces[0] ?? { id: 'seedbed', name: 'Seedbed' };
  const transport = useMemo(
    () => services.createTransport(session, workspace.id, { onUnauthorized: onSessionExpired }),
    [services, session, workspace.id, onSessionExpired]
  );

  return (
    <AnalyticsProvider client={services.analytics}>
      <WorkspaceProvider key={workspace.id} transport={transport} onSessionExpired={onSessionExpired}>
        <AppShell session={session} workspace={workspace} onSwitchWorkspace={setWorkspaceId} onSignOut={onSignOut} />
      </WorkspaceProvider>
    </AnalyticsProvider>
  );
}

/** A Hub session rejected again this soon after a refresh means signing in again. */
const REFRESH_COOLDOWN_MS = 60_000;

export default function App() {
  const config = useConfig();
  const [services, setServices] = useState<Services | null>(null);
  const [session, setSession] = useState<Session | null>(() => sessionStore.load());
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const lastRefresh = useRef(0);
  const expiring = useRef(false);

  useEffect(() => {
    let cancelled = false;
    createServices(config).then(async (s) => {
      if (cancelled) return;
      setServices(s);
      // Resume a signed-in identity (e.g. after a reload) without asking again.
      if (!sessionStore.load()) {
        const restored = await s.auth.restore().catch(() => null);
        if (!cancelled && restored) {
          sessionStore.save(restored);
          setSession(restored);
        }
      }
      if (!cancelled) setRestoring(false);
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
    if (services) void services.auth.signOut(session);
    sessionStore.clear();
    setSession(null);
    setNotice('You have been signed out.');
    window.location.hash = '';
  }, [session, services]);

  /**
   * The Hub rejected the session. Get a fresh one from the identity provider
   * (Firebase refreshes its ID token as needed) once; if that fails, or the
   * new session is rejected again right away, return to sign-in.
   */
  const handleExpired = useCallback(async () => {
    if (!services || expiring.current) return;
    expiring.current = true;
    try {
      if (Date.now() - lastRefresh.current > REFRESH_COOLDOWN_MS) {
        lastRefresh.current = Date.now();
        try {
          const next = await services.auth.refresh();
          sessionStore.save(next);
          setSession(next);
          return;
        } catch {
          // Fall through to sign-in.
        }
      } else {
        await services.auth.signOut(null);
      }
      sessionStore.clear();
      setSession(null);
      setNotice(AUTH_ERROR_MESSAGES.session_expired);
    } finally {
      expiring.current = false;
    }
  }, [services]);

  const onSessionExpired = useCallback(() => void handleExpired(), [handleExpired]);

  if (!services || (restoring && !session)) return <Splash />;

  if (!session) {
    return <SignInPage auth={services.auth} onSignedIn={handleSignedIn} notice={notice} />;
  }

  return <SignedInApp services={services} session={session} onSignOut={handleSignOut} onSessionExpired={onSessionExpired} />;
}
