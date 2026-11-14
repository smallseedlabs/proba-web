import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/card';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';
import { RiskBadge } from './cards';
import type { ComponentRendererProps } from './types';
import { BODY_MAX, HEADLINE_MAX, SUCCESS_METRICS, type CreativeDraftProps, type DraftPlanProps, type DraftTargetingProps } from './creative-draft-model';

/**
 * The Reddit post Proba drafted, as an editable approval card. Approving saves the copy shown (with any
 * edits) as the goal's post copy; nothing is posted or spent from this card. Rejecting saves nothing.
 */
export function CreativeDraftCard({ ui, onAction, disabled, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    description?: string;
    risk?: string;
    creativeDraft: CreativeDraftProps;
    targeting?: DraftTargetingProps;
    plan?: DraftPlanProps;
  };
  const draft = props.creativeDraft;
  const plan = props.plan;
  const targeting = props.targeting;
  const initialCommunities = (targeting?.communities ?? []).join(', ');
  const [headline, setHeadline] = useState(draft.headline);
  const [body, setBody] = useState(draft.body);
  const [useImage, setUseImage] = useState(Boolean(draft.imageUrl));
  const [communities, setCommunities] = useState(initialCommunities);
  const [metric, setMetric] = useState(plan?.successMetric ?? '');
  const [target, setTarget] = useState(plan?.successTarget !== undefined ? String(plan.successTarget) : '');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const copyEdited = headline.trim() !== draft.headline || body.trim() !== draft.body;
  const imageEdited = Boolean(draft.imageUrl) && !useImage;
  const communitiesEdited = targeting !== undefined && communities.trim() !== initialCommunities;
  const planEdited = plan !== undefined && (metric !== plan.successMetric || target.trim() !== (plan.successTarget !== undefined ? String(plan.successTarget) : ''));
  const edited = copyEdited || imageEdited || communitiesEdited || planEdited;

  const approve = () => {
    const h = headline.trim();
    const b = body.trim();
    if (!h || h.length > HEADLINE_MAX) return setError(`The headline needs 1 to ${HEADLINE_MAX} characters.`);
    if (!b || b.length > BODY_MAX) return setError(`The post text needs 1 to ${BODY_MAX.toLocaleString()} characters.`);
    if (planEdited && target.trim() && !(Number(target) > 0)) return setError('The success target must be a positive number.');
    setError(null);
    const values: Record<string, unknown> = {};
    if (copyEdited) Object.assign(values, { headline: h, body: b });
    if (imageEdited) values.useImage = false;
    if (communitiesEdited) values.communities = communities;
    if (planEdited) Object.assign(values, { successMetric: metric, ...(target.trim() ? { successTarget: target.trim() } : {}) });
    onAction?.({ id: 'approve', ...(edited ? { values } : {}) });
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
        {draft.imageUrl && (
          <div className="space-y-2 rounded-lg border bg-surface-sunken/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption font-medium text-foreground">
                {useImage ? 'Landing-page image (included with post)' : 'Landing-page image removed (will post as text only)'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUseImage((prev) => !prev)}
                disabled={disabled}
              >
                {useImage ? 'Remove image' : 'Use image'}
              </Button>
            </div>
            {useImage && (
              <img
                src={draft.imageUrl}
                alt="Landing page preview"
                className="max-h-48 w-auto rounded border object-contain"
              />
            )}
            <FieldHint id={`${id}-image-url`}>
              Source: <span className="break-all">{draft.imageUrl}</span>
            </FieldHint>
          </div>
        )}
        {plan && (
          <div className="grid gap-3 rounded-lg border bg-surface-sunken/60 p-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-metric`}>Success metric</Label>
              <NativeSelect id={`${id}-metric`} value={metric} onChange={(e) => setMetric(e.target.value)} disabled={disabled}>
                {SUCCESS_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor={`${id}-target`}>Target{plan.durationDays ? ` over ${plan.durationDays} days` : ''}</Label>
              <Input id={`${id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} disabled={disabled} />
            </div>
            <p className="text-caption text-muted-foreground sm:col-span-2">Platform: Reddit{plan.durationDays ? ` · Runs ${plan.durationDays} days` : ''}</p>
          </div>
        )}
        {targeting && (
          <div className="space-y-2">
            <div>
              <Label htmlFor={`${id}-communities`}>Subreddits</Label>
              <Input id={`${id}-communities`} value={communities} onChange={(e) => setCommunities(e.target.value)} disabled={disabled} aria-describedby={`${id}-communities-hint`} />
              <FieldHint id={`${id}-communities-hint`}>Comma-separated names. Leave empty to let Reddit find the audience.</FieldHint>
            </div>
            {(['geolocations', 'interests', 'keywords', 'languages'] as const).map((key) =>
              targeting[key]?.length ? (
                <p key={key} className="text-body">
                  <span className="font-medium capitalize">{key}: </span>
                  {targeting[key]!.join(', ')}
                </p>
              ) : null
            )}
          </div>
        )}
        {plan?.reasons && Object.keys(plan.reasons).length > 0 && (
          <div>
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Why Proba chose these</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-body">
              {Object.entries(plan.reasons).map(([field, reason]) => (
                <li key={field}>{reason}</li>
              ))}
            </ul>
          </div>
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
            {edited ? 'Save my edits and approve' : plan || targeting ? 'Approve plan' : 'Approve copy'}
          </Button>
          <Button variant="outline" onClick={() => onAction?.({ id: 'reject' })} disabled={disabled}>
            Reject
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
