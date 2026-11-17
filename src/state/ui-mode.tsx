import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type UIMode = 'auto' | 'controlled';
export type ProbaUserRole = 'operator' | 'instant_byo' | 'instant_managed';

interface UIModeContextValue {
  mode: UIMode;
  userRole: ProbaUserRole;
  canSwitchMode: boolean;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
}

// Defaults to 'controlled' when rendered outside UIModeProvider (e.g. isolated unit tests),
// while UIModeProvider in App.tsx defaults based on userRole.
const UIModeContext = createContext<UIModeContextValue>({
  mode: 'controlled',
  userRole: 'operator',
  canSwitchMode: true,
  setMode: () => {},
  toggleMode: () => {},
});

function storageKey(workspaceId: string): string {
  return `proba.uiMode.${workspaceId}`;
}

function normalizeRole(raw?: string): ProbaUserRole {
  if (raw === 'instant_managed' || raw === 'instant_byo' || raw === 'operator') return raw;
  return 'operator';
}

export function UIModeProvider({
  workspaceId = 'seedbed',
  userRole: rawRole,
  defaultMode,
  children,
}: {
  workspaceId?: string;
  userRole?: string;
  defaultMode?: UIMode;
  children: ReactNode;
}) {
  const userRole = normalizeRole(rawRole);
  const canSwitchMode = userRole !== 'instant_managed';
  const fallbackDefault: UIMode = defaultMode ?? (userRole === 'operator' ? 'controlled' : 'auto');

  const [mode, setModeState] = useState<UIMode>(() => {
    if (!canSwitchMode) return 'auto';
    try {
      const saved = window.localStorage.getItem(storageKey(workspaceId));
      if (saved === 'auto' || saved === 'controlled') return saved;
    } catch {
      // ignore storage errors
    }
    return fallbackDefault;
  });

  const setMode = useCallback(
    (next: UIMode) => {
      if (!canSwitchMode) return;
      setModeState(next);
      try {
        window.localStorage.setItem(storageKey(workspaceId), next);
      } catch {
        // ignore storage errors
      }
    },
    [workspaceId, canSwitchMode]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'auto' ? 'controlled' : 'auto');
  }, [mode, setMode]);

  const effectiveMode: UIMode = canSwitchMode ? mode : 'auto';

  return (
    <UIModeContext.Provider value={{ mode: effectiveMode, userRole, canSwitchMode, setMode, toggleMode }}>
      {children}
    </UIModeContext.Provider>
  );
}

export function useUIMode(): UIModeContextValue {
  return useContext(UIModeContext);
}
