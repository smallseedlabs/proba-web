/**
 * Protocol types shared with proba-hub.
 *
 * TODO: the dependency is pinned to proba-protocol commit c643d52 (PR #3).
 * Switch package.json to `github:smallseedlabs/proba-protocol#v0.1.2` once that
 * tag is published.
 */
export type {
  ActionStyle,
  AlertProps,
  AskPayload,
  AskResolvedPayload,
  ApprovalCardProps,
  CommandEnvelope,
  CommandType,
  ComponentType,
  ConfirmProps,
  ControlAction,
  ErrorPayload,
  EventEnvelope,
  EventType,
  FormProps,
  GoalSummaryProps,
  GoalUpdatedPayload,
  MessagePayload,
  MetricChartProps,
  MetricTileProps,
  NumberInputProps,
  PlanCardProps,
  QuestionChoiceProps,
  QuestionTextProps,
  SelectProps,
  ServerUI,
  SpendBarProps,
  StatusBannerProps,
  StatusPayload,
  TableProps,
  TextProps,
  TimelineItemProps,
  UIAction,
} from '@smallseedlabs/proba-protocol';
