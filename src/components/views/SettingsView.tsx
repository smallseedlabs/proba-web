import type { ReactNode } from 'react';
import { CircleCheck, LogOut } from 'lucide-react';
import type { Session, Workspace } from '../../lib/auth';
import { useWorkspace } from '../../state/workspace';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Page, PageHeader } from './common';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium text-foreground">{children}</dd>
    </div>
  );
}

const GUARDRAILS = [
  { title: 'Plan approval', body: 'Every new plan needs approval from your team before anything launches.' },
  { title: 'Spend approval', body: 'Any change to budgets or bids is proposed to you first and only applied once approved.' },
  { title: 'Spend caps', body: 'Campaign and daily caps are enforced on every action and can never be exceeded automatically.' },
  { title: 'Audit trail', body: 'Every plan, decision and change is recorded in Activity.' },
  { title: 'Pause and emergency stop', body: 'Pause all activity or stop every campaign at any time from the top bar.' },
];

export function SettingsView({ session, workspace, onSignOut }: { session: Session; workspace: Workspace; onSignOut: () => void }) {
  const { state } = useWorkspace();
  const connection =
    state.connection === 'open' ? 'Connected' : state.connection === 'reconnecting' ? 'Reconnecting' : state.connection === 'connecting' ? 'Connecting' : 'Disconnected';

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Settings" description="Your account, workspace and the controls that govern what Proba can do." />
      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader titleAs="h2" title="Account" description="Your profile is managed by your organisation." />
          <CardBody>
            <dl className="divide-y">
              <Row label="Name">{session.user.name}</Row>
              <Row label="Email">{session.user.email}</Row>
              {session.user.role && <Row label="Role">{session.user.role}</Row>}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titleAs="h2" title="Workspace" />
          <CardBody>
            <dl className="divide-y">
              <Row label="Name">{workspace.name}</Row>
              <Row label="Workspaces you can access">{session.workspaces.length}</Row>
              <Row label="Connection">
                <Badge tone={state.connection === 'open' ? 'success' : 'warning'} dot>
                  {connection}
                </Badge>
              </Row>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titleAs="h2" title="Guardrails" description="These controls are enforced by Proba on every action and cannot be overridden by the AI." />
          <CardBody>
            <ul className="divide-y">
              {GUARDRAILS.map((g) => (
                <li key={g.title} className="flex gap-3 py-3">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="text-body font-medium text-foreground">{g.title}</p>
                    <p className="text-body text-muted-foreground">{g.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titleAs="h2"
            title="Session"
            description="Signing out ends your session on this device."
            actions={
              <Button variant="outline" onClick={onSignOut}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            }
            className="border-b-0"
          />
        </Card>
      </div>
    </Page>
  );
}
