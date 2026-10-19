import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRenderer } from './index';
import type { UIComponent } from './types';

describe('ComponentRenderer', () => {
  it('renders TextComponent', () => {
    const ui: UIComponent = {
      component: 'text',
      version: '1.0.0',
      props: {
        text: 'Hello world',
        markdown: false,
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders PlanCardComponent with steps', () => {
    const ui: UIComponent = {
      component: 'plan_card',
      version: '1.0.0',
      props: {
        title: 'Test Plan',
        description: 'Plan description',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            description: 'First step',
            status: 'pending',
            estimatedCost: 100,
          },
        ],
        totalEstimatedCost: 100,
        currency: 'USD',
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Total: USD100')).toBeInTheDocument();
  });

  it('renders ApprovalCardComponent', () => {
    const ui: UIComponent = {
      component: 'approval_card',
      version: '1.0.0',
      props: {
        title: 'Approve Budget',
        description: 'Increase budget',
        currentValue: '$100',
        proposedValue: '$120',
        risk: 'medium',
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Approve Budget')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('$120')).toBeInTheDocument();
  });

  it('renders QuestionChoiceComponent', () => {
    const ui: UIComponent = {
      component: 'question_choice',
      version: '1.0.0',
      props: {
        question: 'Choose an option',
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ],
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Choose an option')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('renders StatusBannerComponent', () => {
    const ui: UIComponent = {
      component: 'status_banner',
      version: '1.0.0',
      props: {
        status: 'executing',
        message: 'Running campaign',
        progress: 50,
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Running campaign')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders GoalSummaryComponent', () => {
    const ui: UIComponent = {
      component: 'goal_summary',
      version: '1.0.0',
      props: {
        title: 'Q4 Campaign',
        status: 'active',
        progress: 75,
        metrics: {
          spend: 500,
          budget: 1000,
          currency: 'USD',
          conversions: 42,
        },
      },
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback" />);
    expect(screen.getByText('Q4 Campaign')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders fallback for unknown component', () => {
    const ui: UIComponent = {
      component: 'unknown_component',
      version: '1.0.0',
      props: {},
    };

    render(<ComponentRenderer ui={ui} fallbackText="Fallback text" />);
    expect(screen.getByText('Fallback text')).toBeInTheDocument();
  });

  it('handles actions in components', () => {
    const handleAction = vi.fn();
    const ui: UIComponent = {
      component: 'plan_card',
      version: '1.0.0',
      props: {
        title: 'Test Plan',
        steps: [],
      },
      actions: [
        {
          id: 'approve',
          label: 'Approve',
          style: 'primary',
        },
      ],
    };

    render(
      <ComponentRenderer
        ui={ui}
        fallbackText="Fallback"
        onAction={handleAction}
      />
    );

    const button = screen.getByText('Approve');
    button.click();
    expect(handleAction).toHaveBeenCalledWith('approve', undefined);
  });
});
