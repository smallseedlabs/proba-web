export interface UIComponent {
  component: string;
  version: string;
  props: Record<string, unknown>;
  actions?: Array<{
    id: string;
    label: string;
    style?: 'primary' | 'secondary' | 'danger';
    opens?: string;
    command?: {
      type: string;
      payload: Record<string, unknown>;
    };
  }>;
}

export interface ComponentRendererProps {
  ui: UIComponent;
  fallbackText: string;
  onAction?: (actionId: string, command?: {
    type: string;
    payload: Record<string, unknown>;
  }) => void;
}
