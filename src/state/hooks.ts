import { useMemo } from 'react';
import { useWorkspace } from './workspace';
import { selectActivity, selectGoals, selectOpenAsks, selectResolvedAskIds } from './selectors';

export function useGoals() {
  const { state } = useWorkspace();
  return useMemo(() => selectGoals(state.events), [state.events]);
}

export function useOpenAsks() {
  const { state } = useWorkspace();
  return useMemo(() => selectOpenAsks(state.events, state.decisions), [state.events, state.decisions]);
}

export function useResolvedAskIds() {
  const { state } = useWorkspace();
  return useMemo(() => selectResolvedAskIds(state.events), [state.events]);
}

export function useActivity() {
  const { state } = useWorkspace();
  return useMemo(() => selectActivity(state.events), [state.events]);
}
