import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/card';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';
import { RiskBadge } from './cards';
import type { ComponentRendererProps } from './types';
import {
  BODY_MAX,
  CTA_OPTIONS,
  HEADLINE_MAX,
  SUCCESS_METRICS,
  type CreativeDraftProps,
  type DraftPlanProps,
  type DraftTargetingProps,
} from './creative-draft-model';

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
  const [imageUrl, setImageUrl] = useState(draft.imageUrl ?? '');
  const [videoUrl, setVideoUrl] = useState(draft.videoUrl ?? '');
  const [ctaType, setCtaType] = useState(draft.ctaType ?? 'LEARN_MORE');
  const [communities, setCommunities] = useState(initialCommunities);
  const [metric, setMetric] = useState(plan?.successMetric ?? '');
  const [target, setTarget] = useState(plan?.successTarget !== undefined ? String(plan.successTarget) : '');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const copyEdited = headline.trim() !== draft.headline || body.trim() !== draft.body;
  const effectiveImageUrl = useImage ? imageUrl.trim() : '';
  const imageEdited = effectiveImageUrl !== (draft.imageUrl ?? '');
  const ctaEdited = ctaType !== (draft.ctaType ?? 'LEARN_MORE');
  const videoEdited = videoUrl.trim() !== (draft.videoUrl ?? '');
  const mediaEdited = imageEdited || videoEdited || ctaEdited;
  const communitiesEdited = targeting !== undefined && !isMetaCheck(plan) && communities.trim() !== initialCommunities;
  const planEdited = plan !== undefined && (metric !== plan.successMetric || target.trim() !== (plan.successTarget !== undefined ? String(plan.successTarget) : ''));
  const edited = copyEdited || imageEdited || mediaEdited || communitiesEdited || planEdited;

  function isMetaCheck(p?: DraftPlanProps): boolean {
    return p?.platform === 'meta';
  }

  const approve = () => {
    const h = headline.trim();
    const b = body.trim();
    if (!h || h.length > HEADLINE_MAX) return setError(`The headline needs 1 to ${HEADLINE_MAX} characters.`);
    if (!b || b.length > BODY_MAX) return setError(`The post text needs 1 to ${BODY_MAX.toLocaleString()} characters.`);
    if (planEdited && target.trim() && !(Number(target) > 0)) return setError('The success target must be a positive number.');
    setError(null);
    const values: Record<string, unknown> = {};
    if (copyEdited) Object.assign(values, { headline: h, body: b });
    if (imageEdited) {
      if (!effectiveImageUrl) values.useImage = false;
      else values.imageUrl = effectiveImageUrl;
    }
    if (videoEdited && videoUrl.trim()) values.videoUrl = videoUrl.trim();
    if (ctaEdited) values.ctaType = ctaType;
    if (communitiesEdited) values.communities = communities;
    if (planEdited) Object.assign(values, { successMetric: metric, ...(target.trim() ? { successTarget: target.trim() } : {}) });
    onAction?.({ id: 'approve', ...(edited ? { values } : {}) });
  };

  const isMeta = plan?.platform === 'meta';
  const platformLabel = isMeta ? 'Meta Ads' : 'Reddit';
  const ctaLabel = CTA_OPTIONS.find((c) => c.value === ctaType)?.label ?? 'Learn More';
  const primarySubreddit =
    communities
      .split(',')
      .map((s) => s.trim().replace(/^r\//, ''))
      .find(Boolean) ?? 'promoted';
  const landingHost = (() => {
    try {
      return draft.landingPageUrl ? new URL(draft.landingPageUrl).hostname.replace(/^www\./, '') : '';
    } catch {
      return draft.landingPageUrl ?? '';
    }
  })();

  return (
    <Card>
      <CardHeader
        title={props.title || `Review the ${platformLabel} ad Proba drafted`}
        description={props.description || fallbackText}
        actions={props.risk ? <RiskBadge risk={props.risk} /> : undefined}
      />
      <CardBody className="space-y-3">
        {isMeta ? (
          <div className="overflow-hidden rounded-xl border bg-surface shadow-xs">
            <div className="flex items-center justify-between border-b bg-surface-sunken/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-caption font-semibold text-surface">
                  {(landingHost[0] ?? 'M').toUpperCase()}
                </span>
                <div>
                  <p className="text-caption font-semibold text-foreground">{landingHost || 'Your Brand'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Sponsored · {(draft.placements?.length ? draft.placements : ['Facebook Feed', 'Instagram Feed']).join(' · ')}
                  </p>
                </div>
              </div>
              <span className="rounded-full border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Meta Feed Preview
              </span>
            </div>
            <p className="whitespace-pre-line px-3 py-2.5 text-body text-foreground">{body || 'Primary text preview'}</p>
            {videoUrl.trim() ? (
              <video src={videoUrl.trim()} controls className="max-h-60 w-full bg-black object-contain" />
            ) : effectiveImageUrl ? (
              <img src={effectiveImageUrl} alt="Meta ad creative preview" className="max-h-60 w-full object-cover" />
            ) : (
              <div className="flex h-36 flex-col items-center justify-center gap-1 bg-surface-sunken px-4 text-center text-caption text-muted-foreground">
                <span className="font-medium text-foreground">Visual asset needed for Meta Feed</span>
                <span>Add an Image URL or Video URL below so Meta can publish this ad.</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t bg-surface-sunken/50 px-3 py-2.5">
              <div className="min-w-0">
                {landingHost && <p className="truncate text-[11px] uppercase text-muted-foreground">{landingHost}</p>}
                <p className="truncate text-body font-semibold text-foreground">{headline || 'Headline preview'}</p>
                {draft.linkDescription && (
                  <p className="truncate text-caption text-muted-foreground">{draft.linkDescription}</p>
                )}
              </div>
              <span className="shrink-0 rounded-md border bg-surface px-3 py-1.5 text-caption font-semibold text-foreground shadow-2xs">
                {ctaLabel}
              </span>
            </div>
            <div className="flex items-center justify-around border-t px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <span>Like</span>
              <span>Comment</span>
              <span>Share</span>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-surface shadow-xs">
            <div className="flex">
              <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r bg-surface-sunken/40 py-2.5 text-[11px] font-semibold text-muted-foreground">
                <span>▲</span>
                <span className="text-foreground">1</span>
                <span>▼</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white">
                      r/
                    </span>
                    <span className="font-semibold text-foreground">r/{primarySubreddit}</span>
                    <span>·</span>
                    <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                      Promoted
                    </span>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Reddit Feed Preview
                  </span>
                </div>
                <p className="px-3 pt-1.5 text-body font-semibold text-foreground">{headline || 'Headline preview'}</p>
                {videoUrl.trim() ? (
                  <video src={videoUrl.trim()} controls className="mt-2 max-h-56 w-full bg-black object-contain" />
                ) : effectiveImageUrl ? (
                  <img src={effectiveImageUrl} alt="Reddit ad creative preview" className="mt-2 max-h-56 w-full object-cover" />
                ) : null}
                <p className="whitespace-pre-line px-3 py-2 text-body text-muted-foreground">{body || 'Post text preview'}</p>
                <div className="flex items-center justify-between gap-2 border-t bg-surface-sunken/40 px-3 py-2">
                  <span className="truncate text-caption text-muted-foreground">{landingHost || 'reddit.com'}</span>
                  <span className="shrink-0 rounded-full border bg-surface px-3 py-1 text-caption font-semibold text-foreground">
                    {ctaLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor={`${id}-headline`} required>
            {isMeta ? `Headline (${headline.trim().length}/40 recommended)` : 'Headline'}
          </Label>
          <Input id={`${id}-headline`} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={HEADLINE_MAX} disabled={disabled} />
        </div>
        <div>
          <Label htmlFor={`${id}-body`} required>
            {isMeta ? 'Primary text' : 'Post text'}
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
        <div className="grid gap-3 rounded-lg border bg-surface-sunken/60 p-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-cta`}>Call-to-action button</Label>
            <NativeSelect id={`${id}-cta`} value={ctaType} onChange={(e) => setCtaType(e.target.value)} disabled={disabled}>
              {CTA_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor={`${id}-image-input`}>Image URL{isMeta ? ' (required unless video set)' : ' (optional)'}</Label>
            <Input
              id={`${id}-image-input`}
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (e.target.value.trim()) setUseImage(true);
              }}
              placeholder="https://…/hero.jpg"
              disabled={disabled}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`${id}-video`}>Video URL (optional MP4/MOV)</Label>
            <Input
              id={`${id}-video`}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…/promo.mp4"
              disabled={disabled}
            />
          </div>
          {draft.visualBrief && (
            <p className="text-caption text-muted-foreground sm:col-span-2">
              <span className="font-medium text-foreground">Visual direction: </span>
              {draft.visualBrief}
            </p>
          )}
        </div>
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
            <p className="text-caption text-muted-foreground sm:col-span-2">
              Platform: {platformLabel}
              {plan.durationDays ? ` · Runs ${plan.durationDays} days` : ''}
            </p>
          </div>
        )}
        {targeting && (
          <div className="space-y-2">
            {!isMeta && (
              <div>
                <Label htmlFor={`${id}-communities`}>Subreddits</Label>
                <Input id={`${id}-communities`} value={communities} onChange={(e) => setCommunities(e.target.value)} disabled={disabled} aria-describedby={`${id}-communities-hint`} />
                <FieldHint id={`${id}-communities-hint`}>Comma-separated names. Leave empty to let Reddit find the audience.</FieldHint>
              </div>
            )}
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
