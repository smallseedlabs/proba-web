import { useId, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardBody, CardFooter } from '../ui/card';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';
import { cn } from '../../lib/utils/cn';
import type { ComponentRendererProps } from './types';

function SubmitRow({ disabled, label = 'Submit answer', pending }: { disabled?: boolean; label?: string; pending?: boolean }) {
  return (
    <CardFooter>
      <Button type="submit" disabled={disabled} loading={pending}>
        {label}
      </Button>
    </CardFooter>
  );
}

export function QuestionChoiceComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as {
    question?: string;
    options?: Array<{ value: string; label: string; description?: string }>;
    allowMultiple?: boolean;
    default?: string | string[];
  };
  const name = useId();
  const errorId = useId();
  const initial = Array.isArray(props.default) ? props.default : props.default ? [props.default] : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);

  if (!props.options) {
    return <p className="text-body text-muted-foreground">{fallbackText}</p>;
  }

  const toggle = (value: string) => {
    setError(null);
    setSelected((current) =>
      props.allowMultiple ? (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]) : [value]
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Choose an option to continue.');
      return;
    }
    onAction?.({ id: 'approve', values: { answer: props.allowMultiple ? selected : selected[0] } });
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody>
          <fieldset disabled={disabled} aria-describedby={error ? errorId : undefined} className="space-y-3">
            <legend className="mb-3 text-title text-foreground">{props.question || fallbackText}</legend>
            {props.allowMultiple && <p className="text-caption text-muted-foreground">Select all that apply.</p>}
            <div className="space-y-2">
              {props.options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1',
                      checked ? 'border-primary bg-primary-subtle' : 'border-border bg-surface hover:bg-muted',
                      disabled && 'cursor-not-allowed opacity-70'
                    )}
                  >
                    <input
                      type={props.allowMultiple ? 'checkbox' : 'radio'}
                      name={name}
                      value={option.value}
                      checked={checked}
                      onChange={() => toggle(option.value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                        props.allowMultiple ? 'rounded' : 'rounded-full',
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-surface'
                      )}
                    >
                      {checked && (props.allowMultiple ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body font-medium text-foreground">{option.label}</span>
                      {option.description && <span className="mt-0.5 block text-body text-muted-foreground">{option.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <FieldError id={errorId}>{error}</FieldError>
        </CardBody>
        <SubmitRow disabled={disabled || !onAction} />
      </form>
    </Card>
  );
}

export function QuestionTextComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as { question?: string; placeholder?: string; multiline?: boolean; default?: string; maxLength?: number };
  const id = useId();
  const errorId = useId();
  const countId = useId();
  const [value, setValue] = useState(props.default ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Enter an answer to continue.');
      return;
    }
    onAction?.({ id: 'approve', values: { answer: value.trim() } });
  };

  const describedBy = [error ? errorId : null, props.maxLength ? countId : null].filter(Boolean).join(' ') || undefined;
  const Control = props.multiline ? Textarea : Input;

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody className="space-y-2">
          <Label htmlFor={id} className="text-title">
            {props.question || fallbackText}
          </Label>
          <Control
            id={id}
            value={value}
            placeholder={props.placeholder}
            maxLength={props.maxLength}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          <FieldError id={errorId}>{error}</FieldError>
          {props.maxLength && (
            <FieldHint id={countId}>
              {value.length} / {props.maxLength} characters
            </FieldHint>
          )}
        </CardBody>
        <SubmitRow disabled={disabled || !onAction} />
      </form>
    </Card>
  );
}

export function NumberInputComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as { label?: string; min?: number; max?: number; step?: number; unit?: string; default?: number };
  const id = useId();
  const errorId = useId();
  const hintId = useId();
  const [raw, setRaw] = useState(props.default !== undefined ? String(props.default) : '');
  const [error, setError] = useState<string | null>(null);

  const range =
    props.min !== undefined && props.max !== undefined
      ? `Between ${props.min} and ${props.max}`
      : props.min !== undefined
        ? `At least ${props.min}`
        : props.max !== undefined
          ? `At most ${props.max}`
          : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(raw);
    if (raw.trim() === '' || Number.isNaN(n)) return setError('Enter a number.');
    if (props.min !== undefined && n < props.min) return setError(`Enter a value of at least ${props.min}.`);
    if (props.max !== undefined && n > props.max) return setError(`Enter a value no greater than ${props.max}.`);
    onAction?.({ id: 'approve', values: { value: n } });
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody className="space-y-2">
          <Label htmlFor={id} className="text-title">
            {props.label || fallbackText}
          </Label>
          <div className="flex max-w-xs items-center gap-2">
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={props.min}
              max={props.max}
              step={props.step}
              value={raw}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={[error ? errorId : null, range ? hintId : null].filter(Boolean).join(' ') || undefined}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
            />
            {props.unit && <span className="text-body text-muted-foreground">{props.unit}</span>}
          </div>
          {range && <FieldHint id={hintId}>{range}{props.unit ? ` ${props.unit}` : ''}.</FieldHint>}
          <FieldError id={errorId}>{error}</FieldError>
        </CardBody>
        <SubmitRow disabled={disabled || !onAction} label="Submit" />
      </form>
    </Card>
  );
}

export function SelectComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as { label?: string; options?: Array<{ value: string; label: string }>; default?: string; multiple?: boolean };
  const id = useId();
  const errorId = useId();
  const [value, setValue] = useState<string[]>(props.default ? [props.default] : []);
  const [error, setError] = useState<string | null>(null);
  const options = props.options ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.length === 0 || value[0] === '') return setError('Choose an option to continue.');
    onAction?.({ id: 'approve', values: { value: props.multiple ? value : value[0] } });
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody className="space-y-2">
          <Label htmlFor={id} className="text-title">
            {props.label || fallbackText}
          </Label>
          <NativeSelect
            id={id}
            multiple={props.multiple}
            value={props.multiple ? value : value[0] ?? ''}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn('max-w-sm', props.multiple && 'h-auto py-1')}
            onChange={(e) => {
              setError(null);
              setValue(Array.from(e.target.selectedOptions).map((o) => o.value));
            }}
          >
            {!props.multiple && (
              <option value="" disabled>
                Select an option
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError id={errorId}>{error}</FieldError>
        </CardBody>
        <SubmitRow disabled={disabled || !onAction} label="Submit" />
      </form>
    </Card>
  );
}

interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'confirm';
  label: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  constraints?: { min?: number; max?: number; step?: number; maxLength?: number };
}

export function FormComponent({ ui, fallbackText, onAction, disabled }: ComponentRendererProps) {
  const props = ui.props as { title?: string; description?: string; fields?: FormField[]; submitLabel?: string };
  const fields = props.fields ?? [];
  const baseId = useId();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, f.default ?? (f.type === 'confirm' ? false : '')]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (id: string, value: unknown) => {
    setValues((v) => ({ ...v, [id]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const output: Record<string, unknown> = {};
    for (const field of fields) {
      const v = values[field.id];
      if (field.type === 'confirm') {
        if (field.required && v !== true) nextErrors[field.id] = 'Please confirm to continue.';
        output[field.id] = v === true;
        continue;
      }
      const str = String(v ?? '').trim();
      if (field.required && !str) {
        nextErrors[field.id] = `${field.label} is required.`;
        continue;
      }
      if (field.type === 'number' && str) {
        const n = Number(str);
        const c = field.constraints ?? {};
        if (Number.isNaN(n)) nextErrors[field.id] = 'Enter a number.';
        else if (c.min !== undefined && n < c.min) nextErrors[field.id] = `Enter a value of at least ${c.min}.`;
        else if (c.max !== undefined && n > c.max) nextErrors[field.id] = `Enter a value no greater than ${c.max}.`;
        else output[field.id] = n;
      } else if (str) {
        output[field.id] = str;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onAction?.({ id: 'approve', values: output });
  };

  if (fields.length === 0) return <p className="text-body text-muted-foreground">{fallbackText}</p>;

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardBody>
          <fieldset disabled={disabled} className="space-y-4">
            <legend className="mb-1 text-title text-foreground">{props.title || fallbackText || 'Details'}</legend>
            {props.description && <p className="text-body text-muted-foreground">{props.description}</p>}
            {fields.map((field) => {
              const id = `${baseId}-${field.id}`;
              const errorId = `${id}-error`;
              const error = errors[field.id];
              const common = {
                id,
                'aria-invalid': error ? true : undefined,
                'aria-describedby': error ? errorId : undefined,
                'aria-required': field.required || undefined,
              } as const;
              if (field.type === 'confirm') {
                return (
                  <div key={field.id}>
                    <label htmlFor={id} className="flex items-start gap-2.5 text-body text-foreground">
                      <input
                        type="checkbox"
                        {...common}
                        checked={values[field.id] === true}
                        onChange={(e) => set(field.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                      />
                      {field.label}
                    </label>
                    <FieldError id={errorId}>{error}</FieldError>
                  </div>
                );
              }
              return (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={id} required={field.required}>
                    {field.label}
                  </Label>
                  {field.type === 'select' ? (
                    <NativeSelect {...common} value={String(values[field.id] ?? '')} onChange={(e) => set(field.id, e.target.value)}>
                      <option value="" disabled>
                        Select an option
                      </option>
                      {(field.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      {...common}
                      type={field.type === 'number' ? 'number' : 'text'}
                      min={field.constraints?.min}
                      max={field.constraints?.max}
                      step={field.constraints?.step}
                      maxLength={field.constraints?.maxLength}
                      value={String(values[field.id] ?? '')}
                      onChange={(e) => set(field.id, e.target.value)}
                    />
                  )}
                  <FieldError id={errorId}>{error}</FieldError>
                </div>
              );
            })}
          </fieldset>
        </CardBody>
        <SubmitRow disabled={disabled || !onAction} label={props.submitLabel || 'Submit'} />
      </form>
    </Card>
  );
}
