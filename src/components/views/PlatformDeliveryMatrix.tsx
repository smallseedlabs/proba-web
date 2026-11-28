import { useState } from 'react';
import type { CreativeVariantRecord, GoalStatus } from '../../lib/actions/client';
import { getPlatformSpec } from '../../lib/platforms/registry';
import { formatCurrency } from '../../lib/utils/format';
import { Badge, type Tone } from '../ui/badge';

type CampaignItem = GoalStatus['now']['campaigns'][number];
type DeliveryState = NonNullable<CampaignItem['delivery']>['state'];

const DELIVERY_TONES: Record<DeliveryState, Tone> = {
  delivering: 'success',
  in_moderation: 'warning',
  paused: 'neutral',
  rejected: 'danger',
  not_delivering: 'warning',
  unknown: 'neutral',
};

function money(value: number | null, currency: string | null): string {
  return value === null ? 'Unknown' : formatCurrency(value, currency ?? 'USD');
}

function formatNativeMetric(value: number, format: 'number' | 'percent' | 'currency', currency: string | null): string {
  if (format === 'currency') return formatCurrency(value, currency ?? 'USD');
  if (format === 'percent') return `${value.toFixed(2)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Registry-driven cross-platform delivery & status matrix.
 * Read-only by default (aligned with autonomous operation); supports any platform via PlatformSpec.
 */
export function PlatformDeliveryMatrix({
  campaigns,
  variants = [],
  onPauseCampaign,
  onResumeCampaign,
  onRunReviewCampaign,
  onCancelCampaign,
  onEnhanceVariant,
  onPromoteVariant,
  pausingId,
}: {
  campaigns: CampaignItem[];
  variants?: CreativeVariantRecord[];
  onPauseCampaign?: (probaCampaignId: string) => void;
  onResumeCampaign?: (probaCampaignId: string) => void;
  onRunReviewCampaign?: (probaCampaignId: string) => void;
  onCancelCampaign?: (probaCampaignId: string) => void;
  onEnhanceVariant?: (variant: CreativeVariantRecord) => void;
  onPromoteVariant?: (variant: CreativeVariantRecord) => void;
  pausingId?: string | null;
}) {
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [expandedPlatformKey, setExpandedPlatformKey] = useState<string | null>(null);
  if (campaigns.length === 0) {
    return (
      <p className="mt-1 text-body text-muted-foreground">
        No ad platform campaigns launched for this goal yet.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2.5" aria-label="Platforms and delivery status">
      {campaigns.map((c) => {
        const spec = getPlatformSpec(c.platform);
        const delivery = c.delivery ?? null;
        const tone: Tone = delivery ? DELIVERY_TONES[delivery.state] : 'neutral';

        return (
          <li key={c.probaCampaignId} className="rounded-lg border bg-background/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body font-semibold text-foreground">{spec.displayName}</span>
                {c.campaignName ? (
                  <span className="text-caption font-medium text-muted-foreground">
                    · {c.campaignName.replace(/&amp;/g, '&')}
                  </span>
                ) : null}
                <Badge tone={tone} dot>
                  {delivery ? delivery.label : 'Registered'}
                </Badge>
                {typeof delivery?.commentsAllowed === 'boolean' ? (
                  <Badge tone={delivery.commentsAllowed ? 'success' : 'warning'}>
                    {delivery.commentsAllowed ? 'Comments open' : 'Comments locked'}
                  </Badge>
                ) : null}
                {c.providerCampaignId ? (
                  <span className="font-mono text-caption text-muted-foreground">ID {c.providerCampaignId}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {c.currentDailyBudget !== null ? (
                  <span className="text-caption font-medium tabular-nums text-muted-foreground">
                    {money(c.currentDailyBudget, c.currency)}/day
                  </span>
                ) : null}
                {onResumeCampaign && c.providerCampaignId && delivery?.state === 'paused' ? (
                  <button
                    type="button"
                    disabled={pausingId !== null && pausingId !== undefined}
                    onClick={() => onResumeCampaign(c.probaCampaignId)}
                    className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-caption font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {pausingId === `resume_${c.probaCampaignId}` ? 'Activating…' : `Activate ${spec.shortLabel}`}
                  </button>
                ) : null}
                {onPauseCampaign && c.providerCampaignId && delivery?.state !== 'paused' ? (
                  <button
                    type="button"
                    disabled={pausingId === c.probaCampaignId || pausingId === 'goal' || pausingId === 'cancel_goal'}
                    onClick={() => onPauseCampaign(c.probaCampaignId)}
                    className="rounded border border-input/70 bg-surface px-2 py-0.5 text-caption font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {pausingId === c.probaCampaignId ? 'Pausing…' : `Pause ${spec.shortLabel}`}
                  </button>
                ) : null}
                {onRunReviewCampaign && c.providerCampaignId ? (
                  <button
                    type="button"
                    disabled={pausingId !== null && pausingId !== undefined}
                    onClick={() => onRunReviewCampaign(c.probaCampaignId)}
                    className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {pausingId === `review_${c.probaCampaignId}` ? 'Reviewing…' : 'AI Review'}
                  </button>
                ) : null}
                {onCancelCampaign && (c.reviewEnabled || (c.providerCampaignId && delivery?.state !== 'paused')) ? (
                  confirmingCancelId === c.probaCampaignId ? (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pausingId !== null && pausingId !== undefined}
                        onClick={() => {
                          setConfirmingCancelId(null);
                          onCancelCampaign(c.probaCampaignId);
                        }}
                        className="rounded border border-danger/50 bg-danger/10 px-2 py-0.5 text-caption font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                      >
                        Confirm cancel {spec.shortLabel}
                      </button>
                      <button
                        type="button"
                        disabled={pausingId !== null && pausingId !== undefined}
                        onClick={() => setConfirmingCancelId(null)}
                        className="rounded border border-input/70 bg-surface px-1.5 py-0.5 text-caption text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pausingId !== null && pausingId !== undefined}
                      onClick={() => setConfirmingCancelId(c.probaCampaignId)}
                      className="rounded border border-danger/30 bg-surface px-2 py-0.5 text-caption font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Cancel {spec.shortLabel}
                    </button>
                  )
                ) : null}
              </div>
            </div>

            {delivery ? (
              <div className="mt-1.5 space-y-1">
                <p className="text-body text-foreground">{delivery.summary}</p>
                {delivery.causes.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-caption text-muted-foreground">
                    {delivery.causes.map((cause) => (
                      <li key={cause}>{cause}</li>
                    ))}
                  </ul>
                )}
                {(delivery.postUrl || delivery.previewUrl) && (
                  <div className="flex flex-wrap gap-3 pt-1 text-caption">
                    {delivery.postUrl && (
                      <a
                        href={delivery.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {spec.entityLinkLabel} ↗
                      </a>
                    )}
                    {delivery.previewUrl && (
                      <a
                        href={delivery.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ad preview ↗
                      </a>
                    )}
                  </div>
                )}
                {delivery.nativeMetrics && (
                  <dl
                    className="mt-2 grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-5"
                    aria-label={`${spec.displayName} metrics`}
                  >
                    {spec.nativeMetricDefs
                      .filter((def) => typeof delivery.nativeMetrics?.[def.key] === 'number')
                      .map((def) => (
                        <div key={def.key}>
                          <dt className="text-[11px] text-muted-foreground">{def.label}</dt>
                          <dd className="text-caption font-semibold tabular-nums text-foreground">
                            {formatNativeMetric(delivery.nativeMetrics![def.key]!, def.format, c.currency)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            ) : (
              <p className="mt-1 text-caption text-muted-foreground">
                Live platform delivery status is not available yet.
              </p>
            )}

            {(() => {
              const platformVariants = variants.filter(
                (v) => v.platform.toLowerCase() === c.platform.toLowerCase()
              );
              if (platformVariants.length === 0) return null;
              const isExpanded = expandedPlatformKey === c.probaCampaignId;
              const latestActive =
                platformVariants.find((v) => v.status === 'winner' || v.status === 'active' || v.status === 'testing') ??
                platformVariants[0];
              return (
                <div className="mt-2 border-t pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedPlatformKey(isExpanded ? null : c.probaCampaignId)}
                      className="text-caption font-medium text-primary hover:underline"
                    >
                      {isExpanded ? '▾' : '▸'} {platformVariants.length} creative version
                      {platformVariants.length === 1 ? '' : 's'}
                    </button>
                    {onEnhanceVariant && latestActive && (
                      <button
                        type="button"
                        onClick={() => onEnhanceVariant(latestActive)}
                        className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
                      >
                        Enhance creative
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {platformVariants.map((v) => {
                        const cr = v.creative as Record<string, unknown>;
                        const headline = typeof cr.headline === 'string' ? cr.headline : 'Untitled creative';
                        const statusTone: Tone =
                          v.status === 'winner' || v.status === 'active'
                            ? 'success'
                            : v.status === 'testing'
                              ? 'warning'
                              : 'neutral';
                        return (
                          <div
                            key={v.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border bg-surface px-2.5 py-1.5 text-caption"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono font-semibold text-foreground">v{v.version}</span>
                                <Badge tone={statusTone}>{v.status}</Badge>
                                {v.mode !== 'initial' && (
                                  <span className="text-[11px] text-muted-foreground">({v.mode})</span>
                                )}
                                <span className="truncate font-medium text-foreground">{headline}</span>
                              </div>
                              {v.changeReason && (
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  Why: {v.changeReason}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {onPromoteVariant && v.status !== 'winner' && v.status !== 'paused' && platformVariants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => onPromoteVariant(v)}
                                  className="rounded border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                                >
                                  Promote Winner
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </li>
        );
      })}
    </ul>
  );
}
