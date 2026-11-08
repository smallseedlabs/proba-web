import { useId, useState, type FormEvent } from 'react';
import { BookOpen, Link2 } from 'lucide-react';
import type { AskPayload } from '../../lib/protocol';
import type { IncomingEvent } from '../../lib/transport';
import {
  buildResearchAnswerPayload,
  displayedResearch,
  parseLandingPageUrl,
  researchAnswerCommand,
  safeHttpHref,
} from '../../lib/research';
import type { ActionRequest } from '../../state/workspace';
import { Button } from '../ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/card';
import { Callout } from '../ui/feedback';
import { FieldError, FieldHint, Input, Label } from '../ui/field';

function SourceUrl({ url }: { url: string }) {
  const href = safeHttpHref(url);
  if (!href) {
    return <span className="break-all font-mono text-caption text-foreground">{url}</span>;
  }
  return (
    <a
      href={href}
      rel="noopener noreferrer nofollow"
      target="_blank"
      className="break-all font-mono text-caption text-primary underline-offset-2 hover:underline"
    >
      {url}
    </a>
  );
}

export function ResearchReviewCard({
  ask,
  event,
  disabled,
  onAction,
}: {
  ask: AskPayload;
  event: IncomingEvent;
  disabled?: boolean;
  onAction: (request: ActionRequest) => void;
}) {
  const research = displayedResearch(ask);
  const [editing, setEditing] = useState(false);
  const [nextUrl, setNextUrl] = useState('');
  const [editError, setEditError] = useState<string | undefined>();
  const ids = { nextUrl: useId(), nextUrlError: useId(), nextUrlHint: useId(), form: useId() };

  const sendChoice = (choice: 'approve' | 'reject' | 'edit', landingPageUrl?: string) => {
    const built = buildResearchAnswerPayload(ask, choice, landingPageUrl ? { landingPageUrl } : undefined);
    if (!built.ok) {
      setEditError(built.message);
      return;
    }
    onAction({
      id: choice,
      command: researchAnswerCommand(built.payload),
    });
  };

  if (!research) {
    return (
      <Card>
        <CardHeader
          title={ask.title || 'Research review'}
          description="Sourced research is required. This is not a spend or campaign-launch approval."
        />
        <CardBody>
          <Callout tone="danger" role="alert">
            This research review has no current sourced artifact (missing, stale, or unsourced findings).
            It cannot be accepted, and accepting research would not grant spend permission.
          </Callout>
        </CardBody>
      </Card>
    );
  }

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseLandingPageUrl(nextUrl);
    if (!parsed.ok) {
      setEditError(parsed.message);
      return;
    }
    setEditError(undefined);
    sendChoice('edit', parsed.url);
  };

  return (
    <Card>
      <CardHeader
        title={ask.title || 'Review sourced research'}
        description={
          ask.description ||
          'Accept findings, assumptions, and unknowns for this landing-URL revision. This is not campaign spend approval.'
        }
      />
      <CardBody className="space-y-5">
        <Callout tone="info">
          Accepting this research binds the current artifact revision only. It does not approve spend, change a budget,
          or launch a campaign.
        </Callout>
        <dl className="grid gap-3 rounded-lg border bg-surface-sunken/60 p-4 text-body sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Landing page</dt>
            <dd className="mt-1">
              <SourceUrl url={research.landingPageUrl} />
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Artifact</dt>
            <dd className="mt-1 break-all font-mono text-caption text-foreground">{research.artifactId}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Version</dt>
            <dd className="mt-1 tabular-nums text-foreground">{research.version}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Input revision</dt>
            <dd className="mt-1 break-all font-mono text-caption text-foreground">{research.inputRevision}</dd>
          </div>
        </dl>

        <section aria-labelledby={`${event.seq}-findings`}>
          <h4 id={`${event.seq}-findings`} className="text-body font-semibold text-foreground">
            Findings
          </h4>
          <ul className="mt-2 space-y-2">
            {research.findings.map((finding) => (
              <li key={finding.id} className="rounded-md border bg-surface px-3 py-2">
                <p className="text-body text-foreground">{finding.text}</p>
                <p className="mt-1 text-caption text-muted-foreground">Sources: {finding.sourceIds.join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={`${event.seq}-assumptions`}>
          <h4 id={`${event.seq}-assumptions`} className="text-body font-semibold text-foreground">
            Assumptions
          </h4>
          {research.assumptions.length === 0 ? (
            <p className="mt-2 text-body text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {research.assumptions.map((row) => (
                <li key={row.id} className="rounded-md border bg-surface px-3 py-2">
                  <p className="text-body text-foreground">{row.text}</p>
                  <p className="mt-1 text-caption text-muted-foreground">Basis: {row.basis}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={`${event.seq}-unknowns`}>
          <h4 id={`${event.seq}-unknowns`} className="text-body font-semibold text-foreground">
            Unknowns
          </h4>
          {research.unknowns.length === 0 ? (
            <p className="mt-2 text-body text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {research.unknowns.map((row) => (
                <li key={row.id} className="rounded-md border bg-surface px-3 py-2">
                  <p className="text-body text-foreground">{row.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={`${event.seq}-sources`}>
          <h4 id={`${event.seq}-sources`} className="flex items-center gap-1.5 text-body font-semibold text-foreground">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Sources
          </h4>
          <ul className="mt-2 space-y-2">
            {research.sources.map((source) => (
              <li key={source.sourceId} className="rounded-md border bg-surface px-3 py-2">
                <p className="text-caption font-medium text-muted-foreground">{source.sourceId}</p>
                <SourceUrl url={source.url} />
                <p className="mt-1 break-all font-mono text-caption text-muted-foreground">sha256 {source.sha256}</p>
              </li>
            ))}
          </ul>
        </section>

        {editing && (
          <form id={ids.form} onSubmit={submitEdit} noValidate className="space-y-2 rounded-lg border border-primary/30 bg-primary-subtle/40 p-4">
            <Label htmlFor={ids.nextUrl} required>
              Replacement landing page URL
            </Label>
            <p className="text-caption text-muted-foreground">
              Current URL (not copied into the field): <SourceUrl url={research.landingPageUrl} />
            </p>
            <Input
              id={ids.nextUrl}
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={nextUrl}
              placeholder="https://"
              aria-invalid={editError ? true : undefined}
              aria-describedby={[editError ? ids.nextUrlError : null, ids.nextUrlHint].filter(Boolean).join(' ')}
              aria-required="true"
              onChange={(e) => {
                setNextUrl(e.target.value);
                setEditError(undefined);
              }}
            />
            <FieldError id={ids.nextUrlError}>{editError}</FieldError>
            <FieldHint id={ids.nextUrlHint}>
              Editing invalidates the current acceptance. Enter a new URL yourself; it is not prefilled. Campaign create
              stays blocked until the new revision is gathered and accepted.
            </FieldHint>
          </form>
        )}
      </CardBody>
      <CardFooter className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button type="submit" form={ids.form} disabled={disabled} variant="primary">
              Send new URL
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setEditing(false);
                setNextUrl('');
                setEditError(undefined);
              }}
            >
              Cancel edit
            </Button>
          </>
        ) : (
          <>
            <Button disabled={disabled} onClick={() => sendChoice('approve')}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Accept research
            </Button>
            <Button variant="outline" disabled={disabled} onClick={() => sendChoice('reject')}>
              Reject research
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setEditing(true);
                setNextUrl('');
                setEditError(undefined);
              }}
            >
              Edit landing URL
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
