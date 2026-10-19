import { ComponentRendererProps } from './types';

export function TextComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    text?: string;
    markdown?: boolean;
    emphasis?: 'normal' | 'bold' | 'italic';
  };

  const text = props.text || fallbackText;
  const className = `text-foreground ${
    props.emphasis === 'bold' ? 'font-bold' : props.emphasis === 'italic' ? 'italic' : ''
  }`;

  if (props.markdown) {
    return (
      <div className={`prose dark:prose-invert ${className}`}>
        <pre className="whitespace-pre-wrap">{text}</pre>
      </div>
    );
  }

  return <div className={className}>{text}</div>;
}

export function PlanCardComponent({ ui, fallbackText, onAction }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    description?: string;
    steps?: Array<{
      id: string;
      title: string;
      description?: string;
      status: 'pending' | 'active' | 'completed' | 'failed';
      estimatedCost?: number;
    }>;
    totalEstimatedCost?: number;
    currency?: string;
  };

  if (!props.steps) {
    return <div className="text-muted-foreground">{fallbackText}</div>;
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div>
        <h3 className="font-bold text-lg">{props.title}</h3>
        {props.description && (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        )}
      </div>
      <div className="space-y-2">
        {props.steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3 p-2 rounded bg-muted/50">
            <div className={`w-2 h-2 rounded-full mt-2 ${
              step.status === 'completed' ? 'bg-green-500' :
              step.status === 'active' ? 'bg-blue-500' :
              step.status === 'failed' ? 'bg-red-500' :
              'bg-gray-400'
            }`} />
            <div className="flex-1">
              <div className="font-medium">{step.title}</div>
              {step.description && (
                <div className="text-sm text-muted-foreground">{step.description}</div>
              )}
              {step.estimatedCost !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  Est: {props.currency}{step.estimatedCost}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {props.totalEstimatedCost !== undefined && (
        <div className="pt-2 border-t">
          <div className="font-bold">
            Total: {props.currency}{props.totalEstimatedCost}
          </div>
        </div>
      )}
      {ui.actions && (
        <div className="flex gap-2 pt-2">
          {ui.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction?.(action.id, action.command)}
              className={`px-4 py-2 rounded font-medium ${
                action.style === 'primary' ? 'bg-primary text-primary-foreground' :
                action.style === 'danger' ? 'bg-destructive text-destructive-foreground' :
                'bg-secondary text-secondary-foreground'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ApprovalCardComponent({ ui, onAction }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    description?: string;
    action?: string;
    currentValue?: string;
    proposedValue?: string;
    risk?: 'low' | 'medium' | 'high';
    costImpact?: {
      current: number;
      proposed: number;
      currency: string;
    };
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div>
        <h3 className="font-bold text-lg">{props.title || 'Approval Required'}</h3>
        {props.description && (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        )}
      </div>
      <div className="bg-muted/50 p-3 rounded space-y-2">
        {props.action && <div className="font-medium">{props.action}</div>}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Current</div>
            <div className="font-mono">{props.currentValue || 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Proposed</div>
            <div className="font-mono font-bold">{props.proposedValue || 'N/A'}</div>
          </div>
        </div>
        {props.risk && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Risk:</span>
            <span className={`text-xs font-medium ${
              props.risk === 'high' ? 'text-red-500' :
              props.risk === 'medium' ? 'text-yellow-500' :
              'text-green-500'
            }`}>
              {props.risk.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {ui.actions && (
        <div className="flex gap-2">
          {ui.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction?.(action.id, action.command)}
              className={`px-4 py-2 rounded font-medium ${
                action.style === 'primary' ? 'bg-primary text-primary-foreground' :
                action.style === 'danger' ? 'bg-destructive text-destructive-foreground' :
                'bg-secondary text-secondary-foreground'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionChoiceComponent({ ui, fallbackText, onAction }: ComponentRendererProps) {
  const props = ui.props as {
    question?: string;
    options?: Array<{ value: string; label: string }>;
  };

  if (!props.options) {
    return <div className="text-muted-foreground">{fallbackText}</div>;
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {props.question && <div className="font-medium">{props.question}</div>}
      <div className="space-y-2">
        {props.options.map((option) => (
          <button
            key={option.value}
            onClick={() => onAction?.(option.value)}
            className="w-full text-left px-4 py-2 rounded border hover:bg-accent transition-colors"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuestionTextComponent({ ui, onAction }: ComponentRendererProps) {
  const props = ui.props as {
    question?: string;
    placeholder?: string;
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {props.question && <div className="font-medium">{props.question}</div>}
      <input
        type="text"
        placeholder={props.placeholder}
        className="w-full px-3 py-2 border rounded bg-background"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onAction) {
            onAction('submit', { type: 'answer_ask', payload: { value: e.currentTarget.value } });
          }
        }}
      />
    </div>
  );
}

export function StatusBannerComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    status?: 'idle' | 'executing' | 'paused' | 'completed' | 'error';
    message?: string;
    progress?: number;
  };

  const statusColors = {
    idle: 'bg-gray-500',
    executing: 'bg-blue-500',
    paused: 'bg-yellow-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div className={`p-3 rounded ${statusColors[props.status || 'idle']} text-white`}>
      <div className="flex items-center justify-between">
        <div className="font-medium">{props.message || fallbackText}</div>
        {props.progress !== undefined && (
          <div className="text-sm">{props.progress}%</div>
        )}
      </div>
      {props.progress !== undefined && (
        <div className="mt-2 bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all"
            style={{ width: `${props.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function MetricTileComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    label?: string;
    value?: string | number;
    trend?: 'up' | 'down' | 'flat';
    change?: string;
  };

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="text-sm text-muted-foreground">{props.label || fallbackText}</div>
      <div className="text-2xl font-bold mt-1">{props.value}</div>
      {props.trend && props.change && (
        <div className={`text-sm mt-1 ${
          props.trend === 'up' ? 'text-green-500' :
          props.trend === 'down' ? 'text-red-500' :
          'text-gray-500'
        }`}>
          {props.trend === 'up' ? '↑' : props.trend === 'down' ? '↓' : '→'} {props.change}
        </div>
      )}
    </div>
  );
}

export function GoalSummaryComponent({ ui, fallbackText }: ComponentRendererProps) {
  const props = ui.props as {
    title?: string;
    status?: string;
    progress?: number;
    metrics?: {
      spend?: number;
      budget?: number;
      currency?: string;
      impressions?: number;
      clicks?: number;
      conversions?: number;
    };
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div>
        <h3 className="font-bold">{props.title || fallbackText}</h3>
        <div className="text-sm text-muted-foreground capitalize">{props.status}</div>
      </div>
      {props.progress !== undefined && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{props.progress}%</span>
          </div>
          <div className="bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${props.progress}%` }}
            />
          </div>
        </div>
      )}
      {props.metrics && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {props.metrics.spend !== undefined && props.metrics.budget !== undefined && (
            <div>
              <div className="text-muted-foreground">Spend</div>
              <div className="font-mono">
                {props.metrics.currency}{props.metrics.spend} / {props.metrics.currency}{props.metrics.budget}
              </div>
            </div>
          )}
          {props.metrics.impressions !== undefined && (
            <div>
              <div className="text-muted-foreground">Impressions</div>
              <div className="font-mono">{props.metrics.impressions.toLocaleString()}</div>
            </div>
          )}
          {props.metrics.clicks !== undefined && (
            <div>
              <div className="text-muted-foreground">Clicks</div>
              <div className="font-mono">{props.metrics.clicks.toLocaleString()}</div>
            </div>
          )}
          {props.metrics.conversions !== undefined && (
            <div>
              <div className="text-muted-foreground">Conversions</div>
              <div className="font-mono">{props.metrics.conversions.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
