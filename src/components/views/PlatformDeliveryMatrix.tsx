import type { GoalStatus } from '../../lib/actions/client';
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
  onPauseCampaign,
  pausingId,
}: {
  campaigns: CampaignItem[];
  onPauseCampaign?: (probaCampaignId: string) => void;
  pausingId?: string | null;
}) {
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
              <div className="flex items-center gap-2">
                {c.currentDailyBudget !== null ? (
                  <span className="text-caption font-medium tabular-nums text-muted-foreground">
                    {money(c.currentDailyBudget, c.currency)}/day
                  </span>
                ) : null}
                {onPauseCampaign && c.providerCampaignId && delivery?.state !== 'paused' ? (
                  <button
                    type="button"
                    disabled={pausingId === c.probaCampaignId || pausingId === 'goal'}
                    onClick={() => onPauseCampaign(c.probaCampaignId)}
                    className="rounded border border-input/70 bg-surface px-2 py-0.5 text-caption font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {pausingId === c.probaCampaignId ? 'Pausing…' : `Pause ${spec.shortLabel}`}
                  </button>
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
          </li>
        );
      })}
    </ul>
  );
}
