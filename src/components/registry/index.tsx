import { ComponentRendererProps } from './types';
import {
  TextComponent,
  PlanCardComponent,
  ApprovalCardComponent,
  QuestionChoiceComponent,
  QuestionTextComponent,
  StatusBannerComponent,
  MetricTileComponent,
  GoalSummaryComponent,
} from './components';

const componentRegistry: Record<
  string,
  (props: ComponentRendererProps) => JSX.Element | null
> = {
  text: TextComponent,
  plan_card: PlanCardComponent,
  approval_card: ApprovalCardComponent,
  question_choice: QuestionChoiceComponent,
  question_text: QuestionTextComponent,
  status_banner: StatusBannerComponent,
  metric_tile: MetricTileComponent,
  goal_summary: GoalSummaryComponent,
  metric_chart: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (chart rendering not implemented)
    </div>
  ),
  table: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (table rendering not implemented)
    </div>
  ),
  spend_bar: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (spend bar not implemented)
    </div>
  ),
  alert: ({ ui, fallbackText }: ComponentRendererProps) => {
    const props = ui.props as { message?: string; severity?: string };
    return (
      <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100">
        {props.message || fallbackText}
      </div>
    );
  },
  timeline_item: ({ fallbackText }: ComponentRendererProps) => (
    <div className="text-sm text-muted-foreground">{fallbackText}</div>
  ),
  form: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (form not implemented)
    </div>
  ),
  number_input: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (number input not implemented)
    </div>
  ),
  select: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (select not implemented)
    </div>
  ),
  confirm: ({ fallbackText }: ComponentRendererProps) => (
    <div className="border rounded-lg p-4 bg-card text-muted-foreground">
      {fallbackText} (confirm not implemented)
    </div>
  ),
};

export function ComponentRenderer(props: ComponentRendererProps) {
  const Component = componentRegistry[props.ui.component];

  if (!Component) {
    return (
      <div className="border rounded-lg p-4 bg-muted text-muted-foreground">
        {props.fallbackText}
      </div>
    );
  }

  return <Component {...props} />;
}
