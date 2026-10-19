import { Button, type ButtonVariant } from '../ui/button';
import type { ComponentRendererProps, UIActionSpec } from './types';

function variantFor(style: UIActionSpec['style']): ButtonVariant {
  if (style === 'primary') return 'primary';
  if (style === 'danger') return 'danger-outline';
  return 'outline';
}

export function ActionBar({
  actions,
  onAction,
  disabled,
  className,
}: {
  actions: UIActionSpec[];
  onAction?: ComponentRendererProps['onAction'];
  disabled?: boolean;
  className?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={variantFor(action.style)}
          disabled={disabled || !onAction}
          onClick={() => onAction?.({ id: action.id, command: action.command })}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
