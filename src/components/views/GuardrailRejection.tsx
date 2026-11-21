import { Badge } from '../ui/badge';

export interface GuardrailVerdictView {
  approved: boolean;
  layer: 'deterministic' | 'llm_checker';
  reason: string;
  field?: string;
  repairAttempt?: number;
  needsHuman?: boolean;
}

export function GuardrailRejection({ verdict }: { verdict: GuardrailVerdictView }) {
  if (verdict.approved) return null;

  return (
    <div
      role="status"
      data-testid="guardrail-rejection"
      className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-body text-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">
          {verdict.layer === 'deterministic' ? 'Deterministic check' : 'Checker review'}
        </Badge>
        {verdict.field && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-caption text-muted-foreground">
            {verdict.field}
          </span>
        )}
        <span className="text-caption text-muted-foreground">
          {verdict.needsHuman
            ? 'Needs your input'
            : verdict.repairAttempt && verdict.repairAttempt > 0
              ? `Repair attempt ${verdict.repairAttempt}`
              : 'Blocked before launch'}
        </span>
      </div>
      <p className="mt-1.5 text-body text-foreground">{verdict.reason}</p>
    </div>
  );
}
