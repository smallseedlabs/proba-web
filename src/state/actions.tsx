import { createContext, useContext, type ReactNode } from 'react';
import type { ActionsClient } from '../lib/actions/client';

const ActionsContext = createContext<ActionsClient | null>(null);

export function ActionsProvider({ client, children }: { client: ActionsClient | null; children: ReactNode }) {
  return <ActionsContext.Provider value={client}>{children}</ActionsContext.Provider>;
}

/** The Hub analytics and action client, or null when it is not available here. */
// eslint-disable-next-line react-refresh/only-export-components
export function useActionsClient(): ActionsClient | null {
  return useContext(ActionsContext);
}
