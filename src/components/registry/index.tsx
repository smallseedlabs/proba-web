import { Component, type ReactNode } from 'react';
import type { ComponentType } from '../../lib/protocol';
import { AlertComponent, StatusBannerComponent, TextComponent, TimelineItemComponent } from './basic';
import { ApprovalCardComponent, ConfirmComponent, GoalSummaryComponent, MetricTileComponent, PlanCardComponent } from './cards';
import { MetricChartComponent } from './chart';
import { FormComponent, NumberInputComponent, QuestionChoiceComponent, QuestionTextComponent, SelectComponent } from './questions';
import { SpendBarComponent } from './spend-bar';
import { DataTableComponent } from './table';
import type { ComponentRendererProps } from './types';

type Renderer = (props: ComponentRendererProps) => JSX.Element | null;

/** Every component in the proba-protocol catalogue has a full implementation. */
const componentRegistry: Record<ComponentType, Renderer> = {
  text: TextComponent,
  plan_card: PlanCardComponent,
  approval_card: ApprovalCardComponent,
  question_choice: QuestionChoiceComponent,
  question_text: QuestionTextComponent,
  metric_tile: MetricTileComponent,
  metric_chart: MetricChartComponent,
  table: DataTableComponent,
  spend_bar: SpendBarComponent,
  status_banner: StatusBannerComponent,
  alert: AlertComponent,
  timeline_item: TimelineItemComponent,
  goal_summary: GoalSummaryComponent,
  form: FormComponent,
  number_input: NumberInputComponent,
  select: SelectComponent,
  confirm: ConfirmComponent,
};

// eslint-disable-next-line react-refresh/only-export-components
export const supportedComponents = Object.keys(componentRegistry) as ComponentType[];

function Fallback({ text }: { text: string }) {
  return <div className="rounded-lg border bg-card px-4 py-3 text-body text-foreground shadow-card">{text}</div>;
}

class RenderBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ComponentRenderer(props: ComponentRendererProps) {
  const Renderer = componentRegistry[props.ui.component as ComponentType];
  const fallback = <Fallback text={props.fallbackText} />;
  if (!Renderer) return fallback;
  return (
    <RenderBoundary fallback={fallback}>
      <Renderer {...props} />
    </RenderBoundary>
  );
}

export type { ComponentRendererProps, UIComponent } from './types';
