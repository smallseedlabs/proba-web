import { describe, it, expect } from 'vitest';
import type { IncomingEvent } from '../lib/transport';
import { executionStateOf, initialWorkspaceState, workspaceReducer, type WorkspaceState } from './reducer';

let seq = 0;
const status = (payload: Record<string, unknown>): IncomingEvent => ({
  kind: 'event',
  seq: ++seq,
  at: new Date(Date.UTC(2026, 9, 1, 10, seq)).toISOString(),
  type: 'status',
  payload,
});

const apply = (state: WorkspaceState, event: IncomingEvent) => workspaceReducer(state, { type: 'event', event });

describe('execution state from the Hub', () => {
  it('starts running and is not changed by pressing a control button', () => {
    const pending = workspaceReducer(initialWorkspaceState, { type: 'control_pending', action: 'kill' });
    expect(pending.operations).toBe('running');
    expect(pending.pendingControl).toBe('kill');
  });

  it('follows executionState on status events and clears the pending control', () => {
    let state = workspaceReducer(initialWorkspaceState, { type: 'control_pending', action: 'pause' });
    state = apply(state, status({ state: 'pause', executionState: 'paused', message: 'Execution pause' }));
    expect(state).toMatchObject({ operations: 'paused', pendingControl: null, lastControl: { action: 'pause', executionState: 'paused' } });

    state = apply(state, status({ state: 'kill', executionState: 'stopped', message: 'Execution kill' }));
    expect(state.operations).toBe('stopped');

    state = apply(state, status({ state: 'resume', executionState: 'running', message: 'Execution resume' }));
    expect(state.operations).toBe('running');
  });

  it('keeps a pause from lifting an emergency stop because the Hub reports stopped', () => {
    let state = apply(initialWorkspaceState, status({ state: 'kill', executionState: 'stopped' }));
    state = apply(state, status({ state: 'pause', executionState: 'stopped' }));
    expect(state.operations).toBe('stopped');
  });

  it('restores the latest state when events are replayed after a reconnect', () => {
    const replay = [
      status({ state: 'pause', executionState: 'paused' }),
      status({ state: 'resume', executionState: 'running' }),
      status({ state: 'kill', executionState: 'stopped' }),
    ];
    expect(replay.reduce(apply, initialWorkspaceState).operations).toBe('stopped');
  });

  it('ignores status events without a valid executionState', () => {
    const progress = status({ state: 'executing', message: 'Producing ad creative' });
    const bogus = status({ state: 'pause', executionState: 'exploded' });
    expect(executionStateOf(progress)).toBeNull();
    expect(executionStateOf(bogus)).toBeNull();
    const stopped = apply(initialWorkspaceState, status({ state: 'kill', executionState: 'stopped' }));
    expect(apply(apply(stopped, progress), bogus).operations).toBe('stopped');
  });

  it('does not take an execution state from non-status events', () => {
    const message: IncomingEvent = { ...status({ executionState: 'stopped' }), type: 'message' };
    expect(apply(initialWorkspaceState, message).operations).toBe('running');
  });
});
