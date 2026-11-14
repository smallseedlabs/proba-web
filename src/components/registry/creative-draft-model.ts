/** Brain-drafted Reddit post carried on an approval card (ui props.creativeDraft). */
export interface CreativeDraftProps {
  type: 'TEXT';
  headline: string;
  body: string;
  rationale?: string;
  claims?: Array<{ text: string; findingId: string }>;
  landingPageUrl?: string;
}

export function isCreativeDraft(value: unknown): value is CreativeDraftProps {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'TEXT' && typeof v.headline === 'string' && typeof v.body === 'string';
}

export const HEADLINE_MAX = 300;
export const BODY_MAX = 10_000;
