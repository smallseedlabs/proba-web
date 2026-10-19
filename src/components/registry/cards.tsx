import { ArrowRight, Check, CircleAlert, LoaderCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, type Tone } from '../ui/badge';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/card';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatNumber } from '../../lib/utils/format';
import { ActionBar } from './actions';
import type { ComponentRendererProps, UIActionSpec } from './types';

type Risk = 'low' | 'medium' | 'high';

const riskMeta: Record<Risk, { label: string; tone: Tone }> = {
  low: { label: 'Low risk', tone: 'success' },
  medium: { label: 'Medium risk', tone: 'warning' },
  high: { label: 'High risk', tone: 'danger' },
};

export function RiskBadge({ risk }: { risk?: string }) {
  const meta = riskMeta[(risk as Risk) ?? 'low'];
  if (!meta) return null;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const stepMeta: Record<string, { label: string; icon: JSX.Element; className: string }> = {
  pending: { label: 'Not started', icon: <span className="h-1.5 w-1.5 rounded-full bg-current" />, className: 'border-border bg-surface text-muted-foreground' },
  in_progress: { label: 'In progress', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />, className: 'border-primary/40 bg-primary-subtle text-primary' },
  completed: { label: 'Completed', icon: <Check className="h-3.5 w-3.5" />, className: 'border-success/40 bg-success-subtle text-success' },
  failed: { label: 'Failed', icon: <CircleAlert className="h-3.5 w-3.5" />, className: 'border-destructive/40 bg-destructive-subtle text-destructive' },
};

export function PlanCardComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    description?: string;
    steps?: Array<{ id: string; title: string; description?: string; status?: string; estimatedCost?: number }>;
    totalEstimatedCost?: number;
    currency?: string;
  };

  if (!props.steps) {
    return <p className="text-body text-muted-foreground">{fallbackText}</p>;
  }

  return (
    <Card>
      <CardHeader title={props.title || 'Proposed plan'} description={props.description} />
      <CardBody className="p-0">
        <ol className="divide-y" aria-label="Plan steps">
          {props.steps.map((step, index) => {
            const status = step.status === 'active' ? 'in_progress' : step.status ?? 'pending';
            const meta = stepMeta[status] ?? stepMeta.pending;
            return (
              <li key={step.id} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-caption font-semibold', meta.className)}
                  aria-hidden="true"
                >
                  {status === 'pending' ? index + 1 : meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-foreground">
                    {step.title}
                    <span className="sr-only">, {meta.label}</span>
                  </p>
                  {step.description && <p className="mt-0.5 text-body text-muted-foreground">{step.description}</p>}
                </div>
                {step.estimatedCost !== undefined && (
                  <p className="shrink-0 text-body font-medium tabular-nums text-foreground">
                    <span className="sr-only">Estimated cost </span>
                    {formatCurrency(step.estimatedCost, props.currency)}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {props.totalEstimatedCost !== undefined && (
          <div className="flex items-center justify-between border-t bg-surface-sunken/60 px-5 py-3">
            <p className="text-body font-medium text-muted-foreground">Total estimated cost</p>
            <p className="text-lead font-semibold tabular-nums text-foreground">{formatCurrency(props.totalEstimatedCost, props.currency)}</p>
          </div>
        )}
      </CardBody>
      {ui.actions && ui.actions.length > 0 && (
        <CardFooter>
          <ActionBar actions={ui.actions} onAction={onAction} disabled={disabled} />
        </CardFooter>
      )}
    </Card>
  );
}

const DEFAULT_APPROVAL_ACTIONS: UIActionSpec[] = [
  { id: 'approve', label: 'Approve', style: 'primary' },
  { id: 'reject', label: 'Decline', style: 'default' },
];

export function ApprovalCardComponent({ ui, onAction, disabled, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    description?: string;
    action?: string;
    currentValue?: string;
    proposedValue?: string;
    risk?: Risk;
    costImpact?: { current: number; proposed: number; currency: string };
  };
  const actions = ui.actions && ui.actions.length > 0 ? ui.actions : DEFAULT_APPROVAL_ACTIONS;
  const delta = props.costImpact ? props.costImpact.proposed - props.costImpact.current : undefined;

  return (
    <Card>
      <CardHeader
        title={props.title || 'Approval required'}
        description={props.description || fallbackText}
        actions={props.risk ? <RiskBadge risk={props.risk} /> : undefined}
      />
      <CardBody className="space-y-4">
        {props.action && <p className="text-body font-medium text-foreground">{props.action}</p>}
        {(props.currentValue || props.proposedValue) && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border bg-surface-sunken/60 p-4">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Current</p>
              <p className="mt-1 text-heading tabular-nums text-foreground">{props.currentValue ?? '—'}</p>
            </div>
            <span className="text-muted-foreground"><ArrowRight className="h-5 w-5" aria-hidden="true" /><span className="sr-only">changes to</span></span>
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Proposed</p>
              <p className="mt-1 text-heading tabular-nums text-primary">{props.proposedValue ?? '—'}</p>
            </div>
          </div>
        )}
        {props.costImpact && delta !== undefined && (
          <dl className="grid grid-cols-3 gap-4 text-body">
            <div>
              <dt className="text-muted-foreground">Current cost</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(props.costImpact.current, props.costImpact.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Proposed cost</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(props.costImpact.proposed, props.costImpact.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Change</dt>
              <dd className={cn('font-medium tabular-nums', delta > 0 ? 'text-warning' : 'text-success')}>
                {delta > 0 ? '+' : ''}
                {formatCurrency(delta, props.costImpact.currency)}
              </dd>
            </div>
          </dl>
        )}
      </CardBody>
      <CardFooter>
        <ActionBar actions={actions} onAction={onAction} disabled={disabled} />
      </CardFooter>
    </Card>
  );
}

export function ConfirmComponent({ ui, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as { title?: string; message?: string; confirmLabel?: string; cancelLabel?: string; risk?: Risk };
  const actions: UIActionSpec[] =
    ui.actions && ui.actions.length > 0
      ? ui.actions
      : [
          { id: 'approve', label: props.confirmLabel || 'Confirm', style: props.risk === 'high' ? 'danger' : 'primary' },
          { id: 'reject', label: props.cancelLabel || 'Cancel', style: 'default' },
        ];
  return (
    <Card>
      <CardHeader title={props.title || 'Please confirm'} actions={props.risk ? <RiskBadge risk={props.risk} /> : undefined} />
      {props.message && (
        <CardBody>
          <p className="text-body text-foreground">{props.message}</p>
        </CardBody>
      )}
      <CardFooter>
        <ActionBar actions={actions} onAction={onAction} disabled={disabled} />
      </CardFooter>
    </Card>
  );
}

interface TrendProp {
  direction?: 'up' | 'down' | 'stable' | 'flat';
  percentage?: number;
}

export function MetricTileComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    label?: string;
    value?: string | number;
    unit?: string;
    trend?: TrendProp | 'up' | 'down' | 'flat';
    change?: string;
    status?: 'good' | 'warning' | 'bad' | 'neutral';
  };
  const trend: TrendProp | undefined = typeof props.trend === 'string' ? { direction: props.trend } : props.trend;
  const direction = trend?.direction === 'flat' ? 'stable' : trend?.direction;
  const changeText = trend?.percentage !== undefined ? `${Math.abs(trend.percentage).toFixed(1)}%` : props.change;
  const statusTone =
    props.status === 'good' ? 'text-success' : props.status === 'bad' ? 'text-destructive' : props.status === 'warning' ? 'text-warning' : 'text-muted-foreground';
  const value = typeof props.value === 'number' ? formatNumber(props.value) : props.value;

  return (
    <Card className="px-5 py-4">
      <p className="text-body font-medium text-muted-foreground">{props.label || fallbackText}</p>
      <p className="mt-1.5 text-heading tabular-nums text-foreground">
        {value}
        {props.unit && <span className="ml-1 text-body font-medium text-muted-foreground">{props.unit}</span>}
      </p>
      {direction && changeText && (
        <p className={cn('mt-1 flex items-center gap-1 text-caption font-medium', statusTone)}>
          {direction === 'up' ? (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : direction === 'down' ? (
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="sr-only">{direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'Unchanged'}</span>
          {changeText}
          <span className="font-normal text-muted-foreground">vs. previous period</span>
        </p>
      )}
    </Card>
  );
}

const goalStatus: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  completed: { label: 'Completed', tone: 'primary' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function GoalStatusBadge({ status }: { status?: string }) {
  const meta = goalStatus[status ?? 'active'] ?? goalStatus.active;
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function GoalSummaryComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    status?: string;
    progress?: number;
    metrics?: { spend?: number; budget?: number; currency?: string; impressions?: number; clicks?: number; conversions?: number };
  };
  const m = props.metrics;
  const stats: Array<[string, string]> = [];
  if (m?.spend !== undefined) stats.push(['Spend', formatCurrency(m.spend, m.currency) + (m.budget ? ` of ${formatCurrency(m.budget, m.currency)}` : '')]);
  if (m?.impressions !== undefined) stats.push(['Impressions', formatNumber(m.impressions)]);
  if (m?.clicks !== undefined) stats.push(['Clicks', formatNumber(m.clicks)]);
  if (m?.conversions !== undefined) stats.push(['Conversions', formatNumber(m.conversions)]);

  return (
    <Card>
      <CardHeader title={props.title || fallbackText} actions={<GoalStatusBadge status={props.status} />} />
      <CardBody className="space-y-4">
        {props.progress !== undefined && (
          <div>
            <div className="mb-1.5 flex justify-between text-body">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{props.progress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Goal progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={props.progress}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, props.progress)}%` }} />
            </div>
          </div>
        )}
        {stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-body font-semibold tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

