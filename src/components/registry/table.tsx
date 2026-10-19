import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card, CardHeader } from '../ui/card';
import { cn } from '../../lib/utils/cn';
import { parseSortableNumber } from '../../lib/utils/format';
import type { ComponentRendererProps } from './types';

type Cell = string | number;
type SortState = { column: number; direction: 'ascending' | 'descending' } | null;

export function DataTableComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as { headers?: string[]; rows?: Cell[][]; sortable?: boolean; caption?: string; title?: string };
  const headers = useMemo(() => props.headers ?? [], [props.headers]);
  const rows = useMemo(() => props.rows ?? [], [props.rows]);
  const sortable = props.sortable !== false;
  const [sort, setSort] = useState<SortState>(null);
  const titleId = useId();

  const numericColumns = useMemo(
    () =>
      headers.map((_, col) => rows.length > 0 && rows.every((row) => row[col] === undefined || row[col] === '' || parseSortableNumber(row[col]) !== null)),
    [headers, rows]
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { column, direction } = sort;
    const factor = direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (numericColumns[column]) {
        return ((parseSortableNumber(av) ?? -Infinity) - (parseSortableNumber(bv) ?? -Infinity)) * factor;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [rows, sort, numericColumns]);

  const toggleSort = (column: number) => {
    setSort((current) => {
      if (!current || current.column !== column) {
        return { column, direction: numericColumns[column] ? 'descending' : 'ascending' };
      }
      return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
    });
  };

  const title = props.title || props.caption || fallbackText || 'Results';

  return (
    <Card className="overflow-hidden">
      <CardHeader id={titleId} title={title} description={sortable ? 'Select a column heading to sort.' : undefined} />
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-body text-muted-foreground">No rows to show yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-body" aria-labelledby={titleId}>
            <thead>
              <tr className="border-b bg-surface-sunken/70">
                {headers.map((header, col) => {
                  const isSorted = sort?.column === col;
                  const ariaSort = isSorted ? sort.direction : sortable ? 'none' : undefined;
                  const Icon = isSorted ? (sort.direction === 'ascending' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={col}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn(
                        'whitespace-nowrap px-5 py-2.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground',
                        numericColumns[col] ? 'text-right' : 'text-left'
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-1 -mx-1 uppercase hover:text-foreground',
                            isSorted && 'text-foreground',
                            numericColumns[col] && 'flex-row-reverse'
                          )}
                        >
                          {header}
                          <Icon className={cn('h-3.5 w-3.5', !isSorted && 'opacity-50')} aria-hidden="true" />
                        </button>
                      ) : (
                        header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/50">
                  {headers.map((_, col) => {
                    const Tag = col === 0 ? 'th' : 'td';
                    return (
                      <Tag
                        key={col}
                        scope={col === 0 ? 'row' : undefined}
                        className={cn(
                          'whitespace-nowrap px-5 py-3',
                          col === 0 ? 'text-left font-medium text-foreground' : 'text-foreground/90',
                          numericColumns[col] && 'text-right tabular-nums'
                        )}
                      >
                        {row[col] ?? '—'}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
