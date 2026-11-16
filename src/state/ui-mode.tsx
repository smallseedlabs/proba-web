import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type UIMode = 'auto' | 'controlled';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
}

// Defaults to 'controlled' when rendered outside UIModeProvider (e.g. isolated unit tests),
// while UIModeProvider in App.tsx defaults to 'auto' for the 1-Click Automated experience.
const UIModeContext = createContext<UIModeContextValue>({
  mode: 'controlled',
  setMode: () => {},
  toggleMode: () => {},
});

function storageKey(workspaceId: string): string {
  return `proba.uiMode.${workspaceId}`;
}

export function UIModeProvider({
  workspaceId = 'seedbed',
  defaultMode = 'auto',
  children,
}: {
  workspaceId?: string;
  defaultMode?: UIMode;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<UIMode>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(workspaceId));
      if (saved === 'auto' || saved === 'controlled') return saved;
    } catch {
      // ignore storage errors
    }
    return defaultMode;
  });

  const setMode = useCallback(
    (next: UIMode) => {
      setModeState(next);
      try {
        window.localStorage.setItem(storageKey(workspaceId), next);
      } catch {
        // ignore storage errors
      }
    },
    [workspaceId]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'auto' ? 'controlled' : 'auto');
  }, [mode, setMode]);

  return <UIModeContext.Provider value={{ mode, setMode, toggleMode }}>{children}</UIModeContext.Provider>;
}

export function useUIMode(): UIModeContextValue {
  return useContext(UIModeContext);
}
