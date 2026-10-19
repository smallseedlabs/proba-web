import { useId } from 'react';
import { Badge, type Tone } from '../ui/badge';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils/cn';
import { formatCurrency } from '../../lib/utils/format';
import type { ComponentRendererProps } from './types';

const WARNING_AT = 80;

function spendState(percent: number): { label: string; tone: Tone; bar: string } {
  if (percent > 100) return { label: 'Over cap', tone: 'danger', bar: 'bg-destructive' };
  if (percent >= 100) return { label: 'Cap reached', tone: 'danger', bar: 'bg-destructive' };
  if (percent >= WARNING_AT) return { label: 'Approaching cap', tone: 'warning', bar: 'bg-warning' };
  return { label: 'Within cap', tone: 'success', bar: 'bg-primary' };
}

export function SpendBarComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { spent?: number; budget?: number; currency?: string; period?: string; showPercentage?: boolean; title?: string };
  const spent = Math.max(0, props.spent ?? 0);
  const budget = Math.max(0, props.budget ?? 0);
  const percent = budget > 0 ? (spent / budget) * 100 : 0;
  const state = spendState(percent);
  const remaining = budget - spent;
  const labelId = useId();
  const showPct = props.showPercentage !== false;

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id={labelId} className="text-body font-medium text-muted-foreground">
            {props.title || 'Spend vs. cap'}
            {props.period && <span className="text-muted-foreground"> · {props.period}</span>}
          </p>
          <p className="mt-1 text-heading tabular-nums text-foreground">
            {formatCurrency(spent, props.currency)}
            <span className="ml-1.5 text-body font-normal text-muted-foreground">of {formatCurrency(budget, props.currency)} cap</span>
          </p>
        </div>
        <Badge tone={state.tone} dot>
          {state.label}
        </Badge>
      </div>

      <div className="relative mt-4">
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={Math.min(spent, budget)}
          aria-valuetext={`${formatCurrency(spent, props.currency)} spent of ${formatCurrency(budget, props.currency)} cap, ${Math.round(percent)}%`}
          className="h-3 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn('h-full rounded-full transition-all', state.bar)} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        <div
          className="absolute top-[-3px] h-[18px] w-0.5 rounded bg-foreground/40"
          style={{ left: `${WARNING_AT}%` }}
          aria-hidden="true"
          title={`Alert threshold at ${WARNING_AT}%`}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-caption text-muted-foreground">
        <span className="tabular-nums">
          {showPct && <span className="font-semibold text-foreground">{Math.round(percent)}% used</span>}
          {showPct && ' · '}
          {remaining >= 0 ? `${formatCurrency(remaining, props.currency)} remaining` : `${formatCurrency(-remaining, props.currency)} over cap`}
        </span>
        <span>Alert threshold {WARNING_AT}%</span>
      </div>
      {!props.spent && !props.budget && fallbackText && <p className="sr-only">{fallbackText}</p>}
    </Card>
  );
}
