import { useEvents } from '../../context/EventContext';

interface WorkspaceProps {
  onSelectThread: (threadId: string) => void;
}

interface EventData {
  kind: string;
  seq: number;
  type: string;
  threadId?: string;
  payload: Record<string, unknown>;
  ui?: {
    props?: {
      title?: string;
    };
  };
}

export function Workspace({ onSelectThread }: WorkspaceProps) {
  const { events } = useEvents();

  const goals = events
    .filter((e) => e.type === 'goal_updated')
    .reduce((acc, event) => {
      const eventData = event as EventData;
      const payload = eventData.payload as { goalId?: string };
      if (payload.goalId) {
        acc.set(payload.goalId, eventData);
      }
      return acc;
    }, new Map<string, EventData>());

  const approvals = events.filter(
    (e) => e.type === 'ask' && ((e as EventData).payload as { askType?: string }).askType !== 'clarify'
  );

  return (
    <div className="w-80 border-r bg-card overflow-y-auto">
      <div className="p-4 space-y-6">
        <section>
          <h2 className="text-sm font-bold uppercase text-muted-foreground mb-3">
            Goals
          </h2>
          <div className="space-y-2">
            {Array.from(goals.values()).map((event) => {
              const payload = event.payload as {
                goalId?: string;
                status?: string;
                progress?: { completed?: number; total?: number };
              };
              const ui = event.ui;
              return (
                <button
                  key={payload.goalId}
                  onClick={() => event.threadId && onSelectThread(event.threadId)}
                  className="w-full text-left p-3 rounded border hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm">
                    {ui?.props?.title || 'Untitled Goal'}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize mt-1">
                    {payload.status || 'unknown'}
                    {payload.progress &&
                      ` • ${payload.progress.completed}/${payload.progress.total}`}
                  </div>
                </button>
              );
            })}
            {goals.size === 0 && (
              <div className="text-sm text-muted-foreground">No goals yet</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase text-muted-foreground mb-3">
            Approvals
          </h2>
          <div className="space-y-2">
            {approvals.map((event) => {
              const eventData = event as EventData;
              const payload = eventData.payload as { title?: string; askType?: string };
              return (
                <button
                  key={event.seq}
                  onClick={() => eventData.threadId && onSelectThread(eventData.threadId)}
                  className="w-full text-left p-3 rounded border border-yellow-500 hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm">{payload.title || 'Approval Required'}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-1">
                    {payload.askType?.replace('_', ' ') || 'approval'}
                  </div>
                </button>
              );
            })}
            {approvals.length === 0 && (
              <div className="text-sm text-muted-foreground">No pending approvals</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase text-muted-foreground mb-3">
            Activity
          </h2>
          <div className="space-y-2">
            {events.slice(-5).reverse().map((event) => (
              <div key={event.seq} className="text-xs text-muted-foreground">
                <span className="font-mono">#{event.seq}</span> {event.type}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
