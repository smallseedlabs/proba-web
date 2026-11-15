import { useState } from 'react';
import type { CreativeVariantRecord } from '../../lib/actions/client';
import { getPlatformSpec } from '../../lib/platforms/registry';

export function EnhanceCreativeModal({
  variant,
  onClose,
  onSubmit,
}: {
  variant: CreativeVariantRecord;
  onClose: () => void;
  onSubmit: (input: {
    mode: 'ab_test' | 'replace';
    headline: string;
    body: string;
    imageUrl?: string;
    changeReason: string;
  }) => Promise<void>;
}) {
  const creative = variant.creative as Record<string, unknown>;
  const [mode, setMode] = useState<'ab_test' | 'replace'>('ab_test');
  const [headline, setHeadline] = useState(typeof creative.headline === 'string' ? creative.headline : '');
  const [body, setBody] = useState(typeof creative.body === 'string' ? creative.body : '');
  const [imageUrl, setImageUrl] = useState(
    typeof creative.imageUrl === 'string'
      ? creative.imageUrl
      : typeof creative.mediaUrl === 'string'
        ? creative.mediaUrl
        : ''
  );
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = getPlatformSpec(variant.platform);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        mode,
        headline: headline.trim(),
        body: body.trim(),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        changeReason: changeReason.trim() || (mode === 'ab_test' ? 'A/B test creative iteration' : 'Replaced previous creative'),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save creative enhancement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="text-section font-semibold text-foreground">
              Enhance {spec.displayName} Creative (v{variant.version} → v{variant.version + 1})
            </h3>
            <p className="text-caption text-muted-foreground">
              Create a new creative version inside the same campaign so budget caps and history stay intact.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-caption text-muted-foreground hover:bg-muted">
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="block text-caption font-medium text-foreground">Rollout mode</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('ab_test')}
                className={`rounded-lg border p-2.5 text-left text-caption ${
                  mode === 'ab_test' ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-muted-foreground'
                }`}
              >
                <div className="font-semibold">A/B Test alongside v{variant.version}</div>
                <div className="mt-0.5 text-[11px]">Keep v{variant.version} active and compare CTR/CPA.</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`rounded-lg border p-2.5 text-left text-caption ${
                  mode === 'replace' ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-muted-foreground'
                }`}
              >
                <div className="font-semibold">Replace v{variant.version}</div>
                <div className="mt-0.5 text-[11px]">Pause v{variant.version} immediately when v{variant.version + 1} launches.</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-caption font-medium text-foreground">Headline</label>
            <input
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-body text-foreground"
            />
          </div>

          <div>
            <label className="block text-caption font-medium text-foreground">Body copy</label>
            <textarea
              rows={3}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-body text-foreground"
            />
          </div>

          <div>
            <label className="block text-caption font-medium text-foreground">Media HTTPS URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-body text-foreground"
            />
          </div>

          <div>
            <label className="block text-caption font-medium text-foreground">What changed & why? (tracked in lineage)</label>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Shorter hook + proof point to lift CTR"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-body text-foreground"
            />
          </div>

          {error && <p className="text-caption text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1.5 text-caption font-medium text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-3.5 py-1.5 text-caption font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : `Create v${variant.version + 1}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
