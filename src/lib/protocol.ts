/**
 * Protocol types shared with proba-hub.
 *
 * Pinned to unmerged protocol PR23 head
 * 298eeb4b4ba3fe14b4bf5077810ce2f433067984 (package 0.6.0 = PR22 research
 * schemas + Zod 4). There is no v0.6.0 tag. Do not pin a nonexistent tag
 * or leftover feat/context-bridge-v0.4.0.
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
  ResearchAcceptanceBinding,
  ResearchReviewAsk,
  SelectProps,
  ServerUI,
  SpendBarProps,
  StatusBannerProps,
  StatusPayload,
  TableProps,
  TextProps,
  TimelineItemProps,
  UIAction,
  UserSuppliedInput,
} from '@smallseedlabs/proba-protocol';
