import { useId, useState, type FormEvent } from 'react';
import { SlidersHorizontal, Target, Zap } from 'lucide-react';
import { parseOptionalLandingPageUrl } from '../../lib/research';
import { cn } from '../../lib/utils/cn';
import { useUIMode } from '../../state/ui-mode';
import { useWorkspace } from '../../state/workspace';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from '../ui/field';

const AUTO_BUDGET_PRESETS = [10, 20, 50] as const;

export function NewGoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createGoal } = useWorkspace();
  const { mode, setMode } = useUIMode();
  const isAuto = mode === 'auto';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [autoPreset, setAutoPreset] = useState<number | 'custom'>(20);
  const [currency, setCurrency] = useState('USD');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [errors, setErrors] = useState<{ title?: string; budget?: string; landingPageUrl?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const ids = {
    title: useId(),
    description: useId(),
    budget: useId(),
    currency: useId(),
    landingPageUrl: useId(),
    titleError: useId(),
    budgetError: useId(),
    budgetHint: useId(),
    landingError: useId(),
    landingHint: useId(),
    form: useId(),
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setBudget('');
    setLandingPageUrl('');
    setErrors({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const landing = parseOptionalLandingPageUrl(landingPageUrl);
    if (!landing.ok) {
      next.landingPageUrl = landing.message.startsWith('landingPageUrl ')
        ? `Landing page URL ${landing.message.slice('landingPageUrl '.length)}`
        : landing.message;
    } else if (isAuto && !landing.url) {
      next.landingPageUrl = 'Enter your website URL (https://...) to generate a campaign.';
    }

    let derivedTitle = title.trim();
    if (isAuto && !derivedTitle && landing.ok && landing.url) {
      try {
        const host = new URL(landing.url).hostname.replace(/^www\./, '');
        derivedTitle = `Campaign for ${host}`;
      } catch {
        derivedTitle = 'New campaign';
      }
    }
    if (!isAuto && !derivedTitle) next.title = 'Describe what you want to achieve.';
    else if (derivedTitle.length > 200) next.title = 'Keep the goal under 200 characters.';

    const amount = isAuto
      ? autoPreset === 'custom'
        ? budget.trim()
          ? Number(budget)
          : undefined
        : autoPreset
      : budget.trim()
        ? Number(budget)
        : undefined;
    if (amount !== undefined && (Number.isNaN(amount) || amount <= 0)) next.budget = 'Enter a daily budget greater than zero.';

    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    const ok = await createGoal({
      title: derivedTitle,
      description: description.trim() || undefined,
      dailyBudget: amount,
      currency,
      landingPageUrl: landing.ok ? landing.url : undefined,
    });
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
      icon={isAuto ? <Zap className="h-5 w-5" /> : <Target className="h-5 w-5" />}
      title={isAuto ? 'Launch a campaign' : 'Create a goal'}
      description={
        isAuto
          ? 'Paste your website URL and daily budget cap. Proba will research your product and build a ready-to-launch campaign.'
          : 'Tell Proba what you want to launch or test. It will propose a plan for your approval before anything goes live.'
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMode(isAuto ? 'controlled' : 'auto')}
            className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground"
          >
            {isAuto ? (
              <>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Switch to Controlled Mode
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Switch to 1-Click Auto
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={ids.form} loading={submitting}>
              {isAuto ? 'Generate Campaign' : 'Create goal'}
            </Button>
          </div>
        </div>
      }
    >
      <form id={ids.form} onSubmit={submit} noValidate className="space-y-4">
        {isAuto ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={ids.landingPageUrl} required>
                Website URL
              </Label>
              <Input
                id={ids.landingPageUrl}
                data-autofocus
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                value={landingPageUrl}
                placeholder="https://yourproduct.com"
                aria-invalid={errors.landingPageUrl ? true : undefined}
                aria-describedby={errors.landingPageUrl ? ids.landingError : undefined}
                onChange={(e) => {
              setLandingPageUrl(e.target.value);
              setErrors((prev) => (prev.landingPageUrl ? { ...prev, landingPageUrl: undefined } : prev));
            }}
              />
              <FieldError id={ids.landingError}>{errors.landingPageUrl}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label>Daily budget cap</Label>
              <div className="grid grid-cols-4 gap-2">
                {AUTO_BUDGET_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAutoPreset(amt)}
                    className={cn(
                      'rounded-lg border py-2 text-caption font-semibold transition-colors',
                      autoPreset === amt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >
                    ${amt}/day
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAutoPreset('custom')}
                  className={cn(
                    'rounded-lg border py-2 text-caption font-semibold transition-colors',
                    autoPreset === 'custom'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  Custom
                </button>
              </div>
              {autoPreset === 'custom' && (
                <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
                  <Input
                    id={ids.budget}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="Daily cap"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  <NativeSelect id={ids.currency} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </NativeSelect>
                </div>
              )}
              <FieldError id={ids.budgetError}>{errors.budget}</FieldError>
              <FieldHint id={ids.budgetHint}>
                Daily spend cap. Nothing is spent until you click Launch Campaign.
              </FieldHint>
            </div>
          </>
        ) : (
          <>
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
        <div className="space-y-1.5">
          <Label htmlFor={ids.landingPageUrl}>Landing page URL</Label>
          <Input
            id={ids.landingPageUrl}
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={landingPageUrl}
            placeholder="https://"
            aria-invalid={errors.landingPageUrl ? true : undefined}
            aria-describedby={[errors.landingPageUrl ? ids.landingError : null, ids.landingHint].filter(Boolean).join(' ')}
            onChange={(e) => {
              setLandingPageUrl(e.target.value);
              setErrors((prev) => (prev.landingPageUrl ? { ...prev, landingPageUrl: undefined } : prev));
            }}
          />
          <FieldError id={ids.landingError}>{errors.landingPageUrl}</FieldError>
          <FieldHint id={ids.landingHint}>
            Optional. Enter the page Proba should research. Leave blank if you do not have one yet — there is no default
            destination. Research gather and campaign create stay blocked until you supply and accept a URL. This field
            is not spend approval.
          </FieldHint>
        </div>
          </>
        )}
      </form>
    </Dialog>
  );
}
