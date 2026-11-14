import { useEffect, useId, useState, type FormEvent } from 'react';
import { ActionsError, type ApprovedCreative } from '../../lib/actions/client';
import { formatDateTime } from '../../lib/utils/format';
import { useActionsClient } from '../../state/actions';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader } from '../ui/card';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';

function publicHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Owner-approved post copy and image for Reddit post creation on this goal.
 * Optional override. By default Proba drafts the post and you approve or edit it in the thread; text saved
 * here replaces that and is used exactly as written. No field is prefilled with model text.
 */
export function PostCreativeCard({ goalId }: { goalId: string }) {
  const client = useActionsClient();
  const [type, setType] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [subreddits, setSubreddits] = useState('');
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    client
      .getCreative(goalId, controller.signal)
      .then((record) => {
        setApprovedAt(record.approvedAt);
        const c = record.creative;
        if (!c) return;
        setType(c.type);
        setHeadline(c.headline);
        setBody(c.body ?? '');
        if (c.type === 'IMAGE') {
          setMediaUrl(c.mediaUrl);
          setCallToAction(c.callToAction ?? '');
        }
        // Ads expects `communities` (subreddit names); older saves used `subreddits`.
        const subs = record.targeting?.communities ?? record.targeting?.subreddits;
        if (Array.isArray(subs)) setSubreddits(subs.filter((s): s is string => typeof s === 'string').join(', '));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [client, goalId]);

  if (!client) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) return setError('Enter the post headline.');
    if (type === 'TEXT' && !body.trim()) return setError('Enter the post text.');
    let creative: ApprovedCreative;
    if (type === 'IMAGE') {
      const url = publicHttpsUrl(mediaUrl);
      if (!url) return setError('Enter the public https address of the image you want to use.');
      creative = {
        type,
        headline: headline.trim(),
        ...(body.trim() ? { body: body.trim() } : {}),
        mediaUrl: url,
        ...(callToAction.trim() ? { callToAction: callToAction.trim() } : {}),
      };
    } else {
      creative = { type, headline: headline.trim(), body: body.trim() };
    }
    const subs = subreddits
      .split(',')
      .map((s) => s.trim().replace(/^\/?r\//i, ''))
      .filter(Boolean);
    setSaving(true);
    try {
      const saved = await client.saveCreative(goalId, creative, subs.length ? { communities: subs } : undefined);
      setApprovedAt(saved.approvedAt);
      setError(null);
    } catch (err) {
      setError(err instanceof ActionsError ? err.message : 'Could not save the post. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Reddit post (optional override)"
        titleAs="h2"
        description={approvedAt ? `Approved ${formatDateTime(approvedAt)}. Used as written when the campaign is created.` : 'Optional. Proba drafts the post for you to approve in the thread. To use your own words instead, write them here; they are used exactly as written.'}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-3" aria-label="Approve Reddit post">
          <div>
            <Label htmlFor={`${id}-type`}>Post type</Label>
            <NativeSelect id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as 'TEXT' | 'IMAGE')}>
              <option value="TEXT">Text</option>
              <option value="IMAGE">Image</option>
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor={`${id}-headline`} required>
              Headline
            </Label>
            <Input id={`${id}-headline`} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={300} />
          </div>
          <div>
            <Label htmlFor={`${id}-body`} required={type === 'TEXT'}>
              Text
            </Label>
            <Textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>
          {type === 'IMAGE' && (
            <>
              <div>
                <Label htmlFor={`${id}-media`} required>
                  Image address
                </Label>
                <Input id={`${id}-media`} type="url" inputMode="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} aria-describedby={`${id}-media-hint`} />
                <FieldHint id={`${id}-media-hint`}>A public https link to an image you own.</FieldHint>
              </div>
              <div>
                <Label htmlFor={`${id}-cta`}>Button text</Label>
                <Input id={`${id}-cta`} value={callToAction} onChange={(e) => setCallToAction(e.target.value)} maxLength={64} />
              </div>
            </>
          )}
          <div>
            <Label htmlFor={`${id}-subs`}>Subreddits</Label>
            <Input id={`${id}-subs`} value={subreddits} onChange={(e) => setSubreddits(e.target.value)} aria-describedby={`${id}-subs-hint`} />
            <FieldHint id={`${id}-subs-hint`}>Optional, separated by commas.</FieldHint>
          </div>
          <FieldError id={`${id}-error`}>{error ?? undefined}</FieldError>
          <Button type="submit" loading={saving}>
            Approve post
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
