import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Film, Image as ImageIcon, Plus, Search, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import type { CreativeAsset } from '../../lib/actions/client';
import { useActionsClient } from '../../state/actions';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Callout, EmptyState } from '../ui/feedback';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Input, Label, NativeSelect, Textarea } from '../ui/field';
import { PageHeader } from './common';

const STATUS_BADGE: Record<CreativeAsset['curationStatus'], { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  approved: { label: 'Approved', tone: 'success' },
  candidate: { label: 'Candidate', tone: 'neutral' },
  do_not_use: { label: 'Do Not Use', tone: 'danger' },
};

const KNOWN_RATIOS: Array<{ label: string; value: number }> = [
  { label: '9:16', value: 9 / 16 },
  { label: '4:5', value: 4 / 5 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

function inferKindFromUrl(rawUrl: string): 'image' | 'video' {
  const clean = rawUrl.split('?')[0]?.toLowerCase() ?? '';
  return /\.(mp4|mov|webm|m4v)$/.test(clean) ? 'video' : 'image';
}

function snapAspectRatio(width: number, height: number): string {
  if (!width || !height) return '4:5';
  const ratio = width / height;
  let best = KNOWN_RATIOS[0]!;
  let minDiff = Math.abs(ratio - best.value);
  for (const candidate of KNOWN_RATIOS.slice(1)) {
    const diff = Math.abs(ratio - candidate.value);
    if (diff < minDiff) {
      best = candidate;
      minDiff = diff;
    }
  }
  return best.label;
}

function deriveTitleFromUrl(rawUrl: string): string | undefined {
  try {
    const pathname = new URL(rawUrl).pathname;
    const filename = pathname.split('/').pop() ?? '';
    const stem = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    return stem ? stem.slice(0, 80) : undefined;
  } catch {
    return undefined;
  }
}

function formatStudioError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  if (/relation .* does not exist/i.test(raw)) {
    return 'Creative Studio storage is not initialized yet. Run Hub database migrations and refresh.';
  }
  return raw;
}

export function StudioView() {
  const client = useActionsClient();
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'image' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'candidate' | 'do_not_use'>('all');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Zero-friction asset onboarding: only URL + optional note; format & ratio auto-derive
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [detectedKind, setDetectedKind] = useState<'image' | 'video'>('image');
  const [detectedRatio, setDetectedRatio] = useState<string | undefined>(undefined);
  const [detectedDims, setDetectedDims] = useState<{ width: number; height: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await client.listAssets({
        ...(kindFilter !== 'all' ? { kind: kindFilter } : {}),
        ...(statusFilter !== 'all' ? { curationStatus: statusFilter } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
        limit: 60,
      });
      setAssets(rows);
    } catch (e) {
      setError(formatStudioError(e, 'Failed to load Studio assets'));
    } finally {
      setLoading(false);
    }
  }, [client, kindFilter, statusFilter, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUrlChange = (value: string) => {
    setNewUrl(value);
    setDetectedKind(inferKindFromUrl(value));
    setDetectedRatio(undefined);
    setDetectedDims(null);
    setPreviewFailed(false);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUrl = newUrl.trim();
    if (!client || !trimmedUrl) return;
    setSaving(true);
    setError(null);
    try {
      const autoTitle = deriveTitleFromUrl(trimmedUrl);
      await client.createAsset({
        kind: detectedKind,
        url: trimmedUrl,
        ...(autoTitle ? { title: autoTitle } : {}),
        ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
        ...(detectedRatio ? { aspectRatio: detectedRatio } : {}),
        curationStatus: 'approved',
      });
      setNewUrl('');
      setNewDescription('');
      setDetectedRatio(undefined);
      setDetectedDims(null);
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(formatStudioError(err, 'Could not save asset'));
    } finally {
      setSaving(false);
    }
  };

  const setCuration = async (id: string, curationStatus: CreativeAsset['curationStatus']) => {
    if (!client) return;
    try {
      const updated = await client.updateAsset(id, { curationStatus });
      setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update curation status');
    }
  };

  const remove = async (id: string) => {
    if (!client) return;
    try {
      await client.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        title="Creative Studio"
        description="Your AI-generated and Brand Truth media library. Proba searches and reuses approved assets here before generating new visuals."
        actions={
          <Button type="button" variant={showAdd ? 'outline' : 'primary'} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {showAdd ? 'Close' : 'Add brand asset'}
          </Button>
        }
      />

      {error && (
        <Callout tone="danger" title="Studio error">
          {error}
        </Callout>
      )}

      {showAdd && (
        <Card>
          <CardHeader
            title="Add Brand Asset"
            description="Paste an image or video URL. Proba detects format and aspect ratio automatically."
          />
          <CardBody>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_180px] sm:items-start">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="studio-url" required>Media URL</Label>
                    <Input
                      id="studio-url"
                      type="url"
                      value={newUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://cdn.yourbrand.com/hero-4x5.jpg"
                      required
                    />
                  </div>
                  {newUrl.trim() && (
                    <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                      <Badge tone="neutral">{detectedKind === 'video' ? 'Video' : 'Image'}</Badge>
                      {detectedRatio && <Badge tone="neutral">{detectedRatio}</Badge>}
                      {detectedDims && (
                        <span>
                          {detectedDims.width}×{detectedDims.height}
                        </span>
                      )}
                      {previewFailed && <span className="text-amber-600">Preview unavailable (URL will still save)</span>}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="studio-desc">Quick note for Proba (optional)</Label>
                    <Textarea
                      id="studio-desc"
                      rows={2}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="e.g. Founder product walkthrough for cold traffic — works best in Meta Reels"
                    />
                  </div>
                </div>

                {newUrl.trim() && (
                  <div className="overflow-hidden rounded-lg border bg-surface-sunken aspect-[4/5] w-full max-w-[180px]">
                    {detectedKind === 'video' ? (
                      <video
                        src={newUrl.trim()}
                        controls
                        muted
                        className="h-full w-full bg-black object-contain"
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          if (v.videoWidth && v.videoHeight) {
                            setDetectedDims({ width: v.videoWidth, height: v.videoHeight });
                            setDetectedRatio(snapAspectRatio(v.videoWidth, v.videoHeight));
                            setPreviewFailed(false);
                          }
                        }}
                        onError={() => setPreviewFailed(true)}
                      />
                    ) : (
                      <img
                        src={newUrl.trim()}
                        alt="Asset preview"
                        className="h-full w-full object-cover"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            setDetectedDims({ width: img.naturalWidth, height: img.naturalHeight });
                            setDetectedRatio(snapAspectRatio(img.naturalWidth, img.naturalHeight));
                            setPreviewFailed(false);
                          }
                        }}
                        onError={() => setPreviewFailed(true)}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !newUrl.trim()}>
                  {saving ? 'Saving…' : 'Save & Approve Asset'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {(assets.length > 0 || query.trim() !== '' || kindFilter !== 'all' || statusFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, description, tags, or prompt…"
              className="pl-9"
            />
          </div>
          <NativeSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | 'image' | 'video')} className="w-36">
            <option value="all">All formats</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </NativeSelect>
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'approved' | 'candidate' | 'do_not_use')}
            className="w-40"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="candidate">Candidates</option>
            <option value="do_not_use">Do Not Use</option>
          </NativeSelect>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border bg-surface-sunken" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-muted-foreground" />}
          title="No creative assets yet"
          description="When Proba generates ad visuals via fal.ai / Pexels or you add Brand Truth assets above, they appear here with full merchandising metadata."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const status = STATUS_BADGE[asset.curationStatus];
            return (
              <Card key={asset.id} className="flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-sunken">
                  {asset.kind === 'video' ? (
                    <video src={asset.url} controls className="h-full w-full bg-black object-contain" />
                  ) : (
                    <img src={asset.url} alt={asset.title || 'Creative asset'} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                      {asset.kind === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {asset.aspectRatio || asset.kind}
                    </span>
                    <span className="rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                      {asset.provider}
                    </span>
                  </div>
                  <div className="absolute right-2.5 top-2.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
                <CardBody className="flex flex-1 flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="line-clamp-1 text-body font-semibold text-foreground">
                      {asset.title || asset.prompt?.slice(0, 60) || 'Untitled asset'}
                    </p>
                    {(asset.description || asset.prompt) && (
                      <p className="line-clamp-3 text-caption text-muted-foreground">
                        {asset.description || asset.prompt}
                      </p>
                    )}
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.tags.slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                    <span className="text-[11px] text-muted-foreground">Used {asset.timesUsed}×</span>
                    <div className="flex items-center gap-1">
                      {asset.curationStatus !== 'approved' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void setCuration(asset.id, 'approved')}
                          title="Approve for Brain reuse"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                      {asset.curationStatus !== 'do_not_use' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void setCuration(asset.id, 'do_not_use')}
                          title="Mark Do Not Use"
                        >
                          <XCircle className="h-3.5 w-3.5 text-amber-600" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void remove(asset.id)}
                        title="Delete asset"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
