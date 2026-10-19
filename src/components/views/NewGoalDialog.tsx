import { useId, useState, type FormEvent } from 'react';
import { Target } from 'lucide-react';
import { useWorkspace } from '../../state/workspace';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';

export function NewGoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createGoal } = useWorkspace();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [errors, setErrors] = useState<{ title?: string; budget?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const ids = { title: useId(), description: useId(), budget: useId(), currency: useId(), titleError: useId(), budgetError: useId(), budgetHint: useId(), form: useId() };

  const reset = () => {
    setTitle('');
    setDescription('');
    setBudget('');
    setErrors({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Describe what you want to achieve.';
    else if (title.trim().length > 200) next.title = 'Keep the goal under 200 characters.';
    const amount = budget.trim() ? Number(budget) : undefined;
    if (amount !== undefined && (Number.isNaN(amount) || amount <= 0)) next.budget = 'Enter a daily budget greater than zero.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    const ok = await createGoal({ title: title.trim(), description: description.trim() || undefined, dailyBudget: amount, currency });
    setSubmitting(false);
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<Target className="h-5 w-5" />}
      title="Create a goal"
      description="Tell Proba what you want to launch or test. It will propose a plan for your approval before anything goes live."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={ids.form} loading={submitting}>
            Create goal
          </Button>
        </>
      }
    >
      <form id={ids.form} onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={ids.title} required>
            Goal
          </Label>
          <Input
            id={ids.title}
            data-autofocus
            value={title}
            placeholder="For example: Test demand for our new trail shoe in Germany"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? ids.titleError : undefined}
            aria-required="true"
            onChange={(e) => setTitle(e.target.value)}
          />
          <FieldError id={ids.titleError}>{errors.title}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.description}>Context</Label>
          <Textarea
            id={ids.description}
            value={description}
            placeholder="Audience, markets, timing, success criteria…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={ids.budget}>Daily budget cap</Label>
            <Input
              id={ids.budget}
              type="number"
              inputMode="decimal"
              min={1}
              value={budget}
              aria-invalid={errors.budget ? true : undefined}
              aria-describedby={[errors.budget ? ids.budgetError : null, ids.budgetHint].filter(Boolean).join(' ')}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.currency}>Currency</Label>
            <NativeSelect id={ids.currency} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </NativeSelect>
          </div>
        </div>
        <FieldError id={ids.budgetError}>{errors.budget}</FieldError>
        <FieldHint id={ids.budgetHint}>Proba will never exceed this cap. Any spend still requires your approval.</FieldHint>
      </form>
    </Dialog>
  );
}
