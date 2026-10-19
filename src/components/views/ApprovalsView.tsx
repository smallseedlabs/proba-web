import { CheckCheck } from 'lucide-react';
import { routeHref } from '../../lib/router';
import { askPayload } from '../../state/selectors';
import { useGoals, useOpenAsks } from '../../state/hooks';
import { useWorkspace } from '../../state/workspace';
import { Card } from '../ui/card';
import { EmptyState, Skeleton } from '../ui/feedback';
import { AskCard } from './AskCard';
import { Page, PageHeader } from './common';

export function ApprovalsView() {
  const { state } = useWorkspace();
  const openAsks = useOpenAsks();
  const goals = useGoals();
  const goalByThread = new Map(goals.map((g) => [g.threadId, g]));
  const decisions = openAsks.filter((e) => askPayload(e)?.askType !== 'clarify');
  const questions = openAsks.filter((e) => askPayload(e)?.askType === 'clarify');

  const goalLink = (threadId?: string) => {
    const goal = goalByThread.get(threadId);
    if (!goal) return undefined;
    return (
      <a href={routeHref({ section: 'goals', id: goal.goalId })} className="text-caption font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {goal.title}
      </a>
    );
  };

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title="Approvals"
        description="Plans, spend changes and questions waiting on your decision. Nothing proceeds until you respond."
      />
      <div className="mt-8 space-y-10">
        {!state.hasLoaded ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading approvals">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : openAsks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCheck className="h-6 w-6" />}
              title="You're all caught up"
              description="There are no plans, spend changes or questions waiting for you. New requests will appear here and in the goal they belong to."
            />
          </Card>
        ) : (
          <>
            {decisions.length > 0 && (
              <section aria-labelledby="approvals-decisions">
                <h2 id="approvals-decisions" className="mb-4 text-title text-foreground">
                  Awaiting approval <span className="text-muted-foreground">({decisions.length})</span>
                </h2>
                <ul className="space-y-8">
                  {decisions.map((event) => (
                    <li key={event.seq}>
                      <AskCard event={event} context={goalLink(event.threadId)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {questions.length > 0 && (
              <section aria-labelledby="approvals-questions">
                <h2 id="approvals-questions" className="mb-4 text-title text-foreground">
                  Questions <span className="text-muted-foreground">({questions.length})</span>
                </h2>
                <ul className="space-y-8">
                  {questions.map((event) => (
                    <li key={event.seq}>
                      <AskCard event={event} context={goalLink(event.threadId)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
