import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/card';
import { FieldError, FieldHint, Input, Label, Textarea } from '../ui/field';
import { RiskBadge } from './cards';
import type { ComponentRendererProps } from './types';
import { BODY_MAX, HEADLINE_MAX, type CreativeDraftProps } from './creative-draft-model';

/**
 * The Reddit post Proba drafted, as an editable approval card. Approving saves the copy shown (with any
 * edits) as the goal's post copy; nothing is posted or spent from this card. Rejecting saves nothing.
 */
export function CreativeDraftCard({ ui, onAction, disabled, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { title?: string; description?: string; risk?: string; creativeDraft: CreativeDraftProps };
  const draft = props.creativeDraft;
  const [headline, setHeadline] = useState(draft.headline);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const edited = headline.trim() !== draft.headline || body.trim() !== draft.body;

  const approve = () => {
    const h = headline.trim();
    const b = body.trim();
    if (!h || h.length > HEADLINE_MAX) return setError(`The headline needs 1 to ${HEADLINE_MAX} characters.`);
    if (!b || b.length > BODY_MAX) return setError(`The post text needs 1 to ${BODY_MAX.toLocaleString()} characters.`);
    setError(null);
    onAction?.({ id: 'approve', ...(edited ? { values: { headline: h, body: b } } : {}) });
  };

  return (
    <Card>
      <CardHeader
        title={props.title || 'Review the Reddit post Proba drafted'}
        description={props.description || fallbackText}
        actions={props.risk ? <RiskBadge risk={props.risk} /> : undefined}
      />
      <CardBody className="space-y-3">
        <div>
          <Label htmlFor={`${id}-headline`} required>
            Headline
          </Label>
          <Input id={`${id}-headline`} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={HEADLINE_MAX} disabled={disabled} />
        </div>
        <div>
          <Label htmlFor={`${id}-body`} required>
            Post text
          </Label>
          <Textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={5} disabled={disabled} />
        </div>
        {draft.landingPageUrl && (
          <FieldHint id={`${id}-url`}>
            Clicks go to your page: <span className="break-all font-medium text-foreground">{draft.landingPageUrl}</span>
          </FieldHint>
        )}
        {draft.rationale && (
          <p className="text-body text-muted-foreground">
            <span className="font-medium text-foreground">Why this angle: </span>
            {draft.rationale}
          </p>
        )}
        {draft.claims && draft.claims.length > 0 && (
          <div>
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Claims and their research source</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-body">
              {draft.claims.map((c) => (
                <li key={`${c.findingId}-${c.text}`}>
                  {c.text} <span className="text-muted-foreground">({c.findingId})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </CardBody>
      <CardFooter>
        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} disabled={disabled}>
            {edited ? 'Save my edits and approve' : 'Approve copy'}
          </Button>
          <Button variant="outline" onClick={() => onAction?.({ id: 'reject' })} disabled={disabled}>
            Reject
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
