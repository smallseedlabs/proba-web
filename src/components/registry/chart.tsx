import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils/cn';
import { formatCurrency, formatNumber } from '../../lib/utils/format';
import { useElementWidth } from '../../lib/utils/useElementWidth';
import { niceTicks } from '../../lib/utils/chart';
import type { ComponentRendererProps } from './types';

export interface ChartPoint {
  label: string;
  value: number;
  timestamp?: string;
}

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

export function MetricChartComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    type?: 'line' | 'bar' | 'area';
    data?: ChartPoint[];
    xAxis?: string;
    yAxis?: string;
    currency?: string;
  };
  const data = useMemo(() => (props.data ?? []).filter((d) => Number.isFinite(d.value)), [props.data]);
  const type = props.type ?? 'line';
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const descId = useId();
  const gradientId = useId().replace(/:/g, '');

  const fmt = (v: number, compact = false) =>
    props.currency ? formatCurrency(v, props.currency, { compact }) : formatNumber(v, { compact });

  const title = props.title || fallbackText || 'Performance';

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title={title} />
        <CardBody>
          <p className="py-10 text-center text-body text-muted-foreground">No data has been reported for this period yet.</p>
        </CardBody>
      </Card>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(width - PAD.left - PAD.right, 100);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = innerW / data.length;
  const x = (i: number) => PAD.left + (type === 'bar' ? band * i + band / 2 : data.length === 1 ? innerW / 2 : (innerW / (data.length - 1)) * i);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 72))));

  const first = data[0].value;
  const last = data[data.length - 1].value;
  const change = first !== 0 ? ((last - first) / first) * 100 : 0;
  const summary = `${title}. ${data.length} data points from ${data[0].label} to ${data[data.length - 1].label}. Latest ${fmt(last)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% over the period. Peak ${fmt(max)}.`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActive((a) => (a === null ? 0 : Math.min(data.length - 1, a + 1)));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => (a === null ? data.length - 1 : Math.max(0, a - 1)));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const activePoint = active !== null ? data[active] : null;

  return (
    <Card>
      <CardHeader
        id={titleId}
        title={title}
        description={
          <span className="inline-flex items-center gap-1.5">
            <span className="text-heading tabular-nums text-foreground">{fmt(last)}</span>
            <span className={cn('inline-flex items-center gap-0.5 text-caption font-medium', change >= 0 ? 'text-success' : 'text-destructive')}>
              {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
              {change >= 0 ? '+' : '−'}
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-caption text-muted-foreground">over period</span>
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            <Table2 className="h-4 w-4" aria-hidden="true" />
            {showTable ? 'Hide data' : 'View data'}
          </Button>
        }
      />
      <CardBody className="pb-3 pt-2">
        <div
          ref={containerRef}
          className="relative rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          <p id={descId} className="sr-only">
            {summary} Use the left and right arrow keys to read individual values.
          </p>
          <svg width={width} height={HEIGHT} role="img" aria-hidden="true" className="block max-w-full overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.22" />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} stroke="hsl(var(--chart-grid))" strokeDasharray={t === 0 ? undefined : '3 4'} />
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                  {fmt(t, true)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={`x-${i}`} x={x(i)} y={HEIGHT - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {d.label}
                </text>
              ) : null
            )}
            {type === 'bar' ? (
              data.map((d, i) => {
                const barW = Math.min(40, band * 0.6);
                return (
                  <rect
                    key={i}
                    x={x(i) - barW / 2}
                    y={y(d.value)}
                    width={barW}
                    height={Math.max(0, y(0) - y(d.value))}
                    rx={3}
                    fill="hsl(var(--chart-1))"
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                );
              })
            ) : (
              <>
                {type === 'area' && <path d={areaPath} fill={`url(#${gradientId})`} />}
                <path d={linePath} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(d.value)}
                    r={active === i ? 5 : data.length <= 16 ? 3 : 0}
                    fill="hsl(var(--surface))"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                  />
                ))}
              </>
            )}
            {active !== null && type !== 'bar' && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} />
            )}
            {data.map((_, i) => (
              <rect
                key={`hit-${i}`}
                x={type === 'bar' ? x(i) - band / 2 : x(i) - (data.length > 1 ? innerW / (data.length - 1) / 2 : innerW / 2)}
                y={PAD.top}
                width={type === 'bar' ? band : data.length > 1 ? innerW / (data.length - 1) : innerW}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </svg>
          {activePoint && active !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-surface-raised px-2.5 py-1.5 text-caption shadow-overlay"
              style={{ left: x(active), top: y(activePoint.value) - 8 }}
              aria-hidden="true"
            >
              <p className="font-medium text-muted-foreground">{activePoint.label}</p>
              <p className="text-body font-semibold tabular-nums text-foreground">{fmt(activePoint.value)}</p>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {activePoint ? `${activePoint.label}: ${fmt(activePoint.value)}` : ''}
          </p>
        </div>
        {(props.xAxis || props.yAxis) && (
          <p className="mt-1 text-caption text-muted-foreground">
            {props.yAxis}
            {props.xAxis && props.yAxis ? ' by ' : ''}
            {props.xAxis?.toLowerCase()}
          </p>
        )}
        {showTable && (
          <div className="mt-3 max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-body">
              <caption className="sr-only">{title} data</caption>
              <thead className="bg-surface-sunken text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{props.xAxis || 'Period'}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">{props.yAxis || 'Value'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{d.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
