import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentRenderer, supportedComponents } from './index';
import type { UIComponent } from './types';

const ui = (component: string, props: Record<string, unknown>, actions?: UIComponent['actions']): UIComponent => ({
  component,
  version: '1.0.0',
  props,
  actions,
});

describe('ComponentRenderer', () => {
  it('implements every component in the protocol catalogue', () => {
    expect(supportedComponents.sort()).toEqual(
      [
        'alert',
        'approval_card',
        'confirm',
        'form',
        'goal_summary',
        'metric_chart',
        'metric_tile',
        'number_input',
        'plan_card',
        'question_choice',
        'question_text',
        'select',
        'spend_bar',
        'status_banner',
        'table',
        'text',
        'timeline_item',
      ].sort()
    );
  });

  it('renders text, including safe markdown', () => {
    render(<ComponentRenderer ui={ui('text', { text: 'Hello **world**', markdown: true })} fallbackText="Fallback" />);
    expect(screen.getByText('world').tagName).toBe('STRONG');
  });

  it('falls back to the fallback text for unknown components', () => {
    render(<ComponentRenderer ui={ui('hologram', {})} fallbackText="Plain-text summary" />);
    expect(screen.getByText('Plain-text summary')).toBeInTheDocument();
  });

  it('falls back instead of crashing when props are malformed', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ComponentRenderer ui={ui('table', { headers: ['A'], rows: 'not-an-array' })} fallbackText="Results summary" />);
    expect(screen.getByText('Results summary')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders a plan card with steps, costs and command actions', async () => {
    const onAction = vi.fn();
    const command = { type: 'approve_plan', payload: { planId: 'p1', approved: true } };
    render(
      <ComponentRenderer
        ui={ui(
          'plan_card',
          {
            title: 'Launch plan',
            description: 'Two steps',
            steps: [
              { id: 's1', title: 'Create creative', status: 'completed', estimatedCost: 450 },
              { id: 's2', title: 'Run test', status: 'pending', estimatedCost: 1050 },
            ],
            totalEstimatedCost: 1500,
            currency: 'USD',
          },
          [{ id: 'approve', label: 'Approve plan', style: 'primary', command }]
        )}
        fallbackText="Plan"
        onAction={onAction}
      />
    );
    expect(screen.getByRole('heading', { name: 'Launch plan' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Plan steps' }).children).toHaveLength(2);
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', command });
  });

  it('renders an approval card with default Approve and Decline actions', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('approval_card', {
          title: 'Increase budget',
          description: 'More reach',
          action: 'Raise daily budget',
          currentValue: '$100',
          proposedValue: '$120',
          risk: 'medium',
          costImpact: { current: 100, proposed: 120, currency: 'USD' },
        })}
        fallbackText="Approval"
        onAction={onAction}
      />
    );
    expect(screen.getByText('Medium risk')).toBeInTheDocument();
    expect(screen.getByText('+$20')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'reject', command: undefined });
  });

  it('disables actions once a decision has been made', () => {
    render(<ComponentRenderer ui={ui('approval_card', { title: 'Increase budget' })} fallbackText="" onAction={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  it('submits a single-choice question and requires a selection', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('question_choice', {
          question: 'Who should see the ads?',
          options: [
            { value: 'active', label: 'Active customers', description: 'Recommended' },
            { value: 'all', label: 'All customers' },
          ],
        })}
        fallbackText="Question"
        onAction={onAction}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(screen.getByText('Choose an option to continue.')).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('radio', { name: /Active customers/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { answer: 'active' } });
  });

  it('supports multiple-choice questions', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('question_choice', { question: 'Channels', allowMultiple: true, options: [{ value: 'meta', label: 'Meta' }, { value: 'google', label: 'Google' }] })}
        fallbackText=""
        onAction={onAction}
      />
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Meta' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Google' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { answer: ['meta', 'google'] } });
  });

  it('validates and submits free-text questions', async () => {
    const onAction = vi.fn();
    render(<ComponentRenderer ui={ui('question_text', { question: 'Any constraints?', maxLength: 50 })} fallbackText="" onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(screen.getByRole('textbox', { name: 'Any constraints?' })).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(screen.getByRole('textbox', { name: 'Any constraints?' }), 'UK only');
    expect(screen.getByText('7 / 50 characters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { answer: 'UK only' } });
  });

  it('enforces number input ranges', async () => {
    const onAction = vi.fn();
    render(<ComponentRenderer ui={ui('number_input', { label: 'Daily budget', min: 10, max: 500, unit: 'USD' })} fallbackText="" onAction={onAction} />);
    const input = screen.getByRole('spinbutton', { name: 'Daily budget' });
    await userEvent.type(input, '900');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Enter a value no greater than 500.')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '120');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { value: 120 } });
  });

  it('submits a select', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('select', { label: 'Market', options: [{ value: 'uk', label: 'United Kingdom' }, { value: 'de', label: 'Germany' }] })}
        fallbackText=""
        onAction={onAction}
      />
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Market' }), 'de');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { value: 'de' } });
  });

  it('validates required form fields and submits typed values', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('form', {
          title: 'Campaign details',
          fields: [
            { id: 'name', type: 'text', label: 'Campaign name', required: true },
            { id: 'cap', type: 'number', label: 'Spend cap', constraints: { min: 100 } },
            { id: 'ok', type: 'confirm', label: 'I accept the spend cap', required: true },
          ],
        })}
        fallbackText=""
        onAction={onAction}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Campaign name is required.')).toBeInTheDocument();
    expect(screen.getByText('Please confirm to continue.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Campaign name/ }), 'Spring');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Spend cap' }), '250');
    await userEvent.click(screen.getByRole('checkbox', { name: 'I accept the spend cap' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', values: { name: 'Spring', cap: 250, ok: true } });
  });

  it('renders a confirm with protocol labels', async () => {
    const onAction = vi.fn();
    render(
      <ComponentRenderer
        ui={ui('confirm', { title: 'Launch now?', message: 'Ads go live immediately.', confirmLabel: 'Launch', cancelLabel: 'Not yet', risk: 'high' })}
        fallbackText=""
        onAction={onAction}
      />
    );
    expect(screen.getByText('High risk')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Launch' }));
    expect(onAction).toHaveBeenCalledWith({ id: 'approve', command: undefined });
  });

  it('renders a status banner with an accessible progress bar', () => {
    render(<ComponentRenderer ui={ui('status_banner', { status: 'executing', message: 'Running campaign', progress: 50 })} fallbackText="" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Running campaign' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('renders metric tiles with protocol trend objects', () => {
    render(<ComponentRenderer ui={ui('metric_tile', { label: 'Conversions', value: 1204, trend: { direction: 'up', percentage: 12.5 }, status: 'good' })} fallbackText="" />);
    expect(screen.getByText('1,204')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('Up')).toBeInTheDocument();
  });

  it('renders a goal summary', () => {
    render(
      <ComponentRenderer
        ui={ui('goal_summary', { title: 'Q4 launch', status: 'active', progress: 75, metrics: { spend: 500, budget: 1000, currency: 'USD', conversions: 42 } })}
        fallbackText=""
      />
    );
    expect(screen.getByRole('heading', { name: 'Q4 launch' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('$500 of $1,000')).toBeInTheDocument();
  });

  it('renders dismissible alerts', async () => {
    render(<ComponentRenderer ui={ui('alert', { severity: 'warning', title: 'Cap nearly reached', message: '90% used', dismissible: true })} fallbackText="" />);
    expect(screen.getByText('Cap nearly reached')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Cap nearly reached')).not.toBeInTheDocument();
  });

  it('renders timeline items with metadata', () => {
    render(
      <ComponentRenderer
        ui={ui('timeline_item', { timestamp: '2026-10-01T10:00:00Z', title: 'Variant paused', status: 'completed', metadata: { CPA: '$17.22' } })}
        fallbackText=""
      />
    );
    expect(screen.getByText('Variant paused')).toBeInTheDocument();
    expect(screen.getByText('$17.22')).toBeInTheDocument();
  });
});

describe('metric_chart', () => {
  const data = [
    { label: 'Mon', value: 10 },
    { label: 'Tue', value: 20 },
    { label: 'Wed', value: 15 },
  ];

  it.each(['line', 'area', 'bar'])('draws a %s chart with an accessible summary', (type) => {
    const { container } = render(<ComponentRenderer ui={ui('metric_chart', { title: 'Conversions', type, data, xAxis: 'Day', yAxis: 'Conversions' })} fallbackText="" />);
    expect(screen.getByRole('heading', { name: 'Conversions' })).toBeInTheDocument();
    expect(screen.getByText(/3 data points from Mon to Wed/)).toBeInTheDocument();
    expect(container.querySelector(type === 'bar' ? 'rect[rx="3"]' : 'path')).not.toBeNull();
    expect(screen.getByText('+50.0%')).toBeInTheDocument();
  });

  it('reads individual values with the keyboard', async () => {
    render(<ComponentRenderer ui={ui('metric_chart', { title: 'Spend', type: 'line', data, currency: 'USD' })} fallbackText="" />);
    screen.getByRole('group', { name: 'Spend' }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByText('Tue: $20')).toBeInTheDocument();
  });

  it('can show the underlying data as a table', async () => {
    render(<ComponentRenderer ui={ui('metric_chart', { title: 'Spend', type: 'line', data, xAxis: 'Day', yAxis: 'Spend' })} fallbackText="" />);
    await userEvent.click(screen.getByRole('button', { name: 'View data' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('shows an empty state without data', () => {
    render(<ComponentRenderer ui={ui('metric_chart', { title: 'Spend', type: 'line', data: [] })} fallbackText="" />);
    expect(screen.getByText('No data has been reported for this period yet.')).toBeInTheDocument();
  });
});

describe('table', () => {
  const tableUi = ui('table', {
    caption: 'Variants',
    sortable: true,
    headers: ['Variant', 'Spend', 'CTR'],
    rows: [
      ['Bravo', '$1,200.00', '3.4%'],
      ['Alpha', '$95.50', '5.9%'],
      ['Charlie', '$604.10', '1.2%'],
    ],
  });

  const firstColumn = () => screen.getAllByRole('rowheader').map((c) => c.textContent);

  it('sorts numeric columns by value, descending first, and toggles direction', async () => {
    render(<ComponentRenderer ui={tableUi} fallbackText="" />);
    const spend = screen.getByRole('columnheader', { name: /Spend/ });
    expect(spend).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(screen.getByRole('button', { name: /Spend/ }));
    expect(spend).toHaveAttribute('aria-sort', 'descending');
    expect(firstColumn()).toEqual(['Bravo', 'Charlie', 'Alpha']);

    await userEvent.click(screen.getByRole('button', { name: /Spend/ }));
    expect(spend).toHaveAttribute('aria-sort', 'ascending');
    expect(firstColumn()).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  it('sorts text columns alphabetically', async () => {
    render(<ComponentRenderer ui={tableUi} fallbackText="" />);
    await userEvent.click(screen.getByRole('button', { name: /Variant/ }));
    expect(firstColumn()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('renders static tables without sort controls', () => {
    render(<ComponentRenderer ui={{ ...tableUi, props: { ...tableUi.props, sortable: false } }} fallbackText="" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('spend_bar', () => {
  it.each([
    [600, 'Within cap', '$400 remaining'],
    [850, 'Approaching cap', '$150 remaining'],
    [1000, 'Cap reached', '$0 remaining'],
    [1100, 'Over cap', '$100 over cap'],
  ])('shows %i of 1000 as %s', (spent, label, remaining) => {
    render(<ComponentRenderer ui={ui('spend_bar', { spent, budget: 1000, currency: 'USD', period: 'This month' })} fallbackText="" />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(remaining.replace('$', '\\$')))).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '1000');
    expect(bar.getAttribute('aria-valuetext')).toContain('spent of $1,000 cap');
  });
});
