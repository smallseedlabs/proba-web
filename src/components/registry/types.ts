import type { ActionRequest } from '../../state/workspace';

export interface UIActionSpec {
  id: string;
  label: string;
  /** Protocol styles are primary | default | danger; secondary is accepted for older payloads. */
  style?: 'primary' | 'default' | 'secondary' | 'danger';
  opens?: unknown;
  command?: Record<string, unknown>;
}

export interface UIComponent {
  component: string;
  version: string;
  props: Record<string, unknown>;
  actions?: UIActionSpec[];
}

export interface ComponentRendererProps {
  ui: UIComponent;
  fallbackText: string;
  onAction?: (request: ActionRequest) => void;
  /** Set once the user has responded, or while the response is in flight. */
  disabled?: boolean;
}

export type { ActionRequest };
