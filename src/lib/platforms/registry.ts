export interface NativeMetricDef {
  key: string;
  label: string;
  format: 'number' | 'percent' | 'currency';
}

export interface PlatformSpec {
  id: string;
  displayName: string;
  shortLabel: string;
  entityLinkLabel: string;
  capabilities: {
    textAds: boolean;
    imageAds: boolean;
    budgetUpdate: boolean;
    pause: boolean;
  };
  nativeMetricDefs: NativeMetricDef[];
}

const REGISTRY: Record<string, PlatformSpec> = {
  reddit: {
    id: 'reddit',
    displayName: 'Reddit Ads',
    shortLabel: 'Reddit',
    entityLinkLabel: 'View Reddit post',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'impressions', label: 'Impressions', format: 'number' },
      { key: 'clicks', label: 'Clicks', format: 'number' },
      { key: 'spend', label: 'Spend', format: 'currency' },
      { key: 'ctr', label: 'CTR', format: 'percent' },
      { key: 'cpc', label: 'CPC', format: 'currency' },
      { key: 'ecpm', label: 'eCPM', format: 'currency' },
      { key: 'reach', label: 'Reach', format: 'number' },
      { key: 'video_viewable_impressions', label: 'Video views', format: 'number' },
      { key: 'conversions', label: 'Conversions', format: 'number' },
    ],
  },
  meta: {
    id: 'meta',
    displayName: 'Meta Ads',
    shortLabel: 'Meta',
    entityLinkLabel: 'View Meta ad',
    capabilities: { textAds: false, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'reach', label: 'Reach', format: 'number' },
      { key: 'frequency', label: 'Frequency', format: 'number' },
      { key: 'ctr', label: 'CTR', format: 'percent' },
      { key: 'cpc', label: 'CPC', format: 'currency' },
      { key: 'ecpm', label: 'CPM', format: 'currency' },
      { key: 'conversions', label: 'Conversions', format: 'number' },
    ],
  },
  google: {
    id: 'google',
    displayName: 'Google Ads',
    shortLabel: 'Google',
    entityLinkLabel: 'View Google ad',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'impression_share', label: 'Impr. share', format: 'percent' },
      { key: 'quality_score', label: 'Quality score', format: 'number' },
    ],
  },
  microsoft: {
    id: 'microsoft',
    displayName: 'Microsoft Advertising',
    shortLabel: 'Microsoft',
    entityLinkLabel: 'View Microsoft ad',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'impression_share', label: 'Impr. share', format: 'percent' },
      { key: 'exact_match_is', label: 'Exact match IS', format: 'percent' },
    ],
  },
  linkedin: {
    id: 'linkedin',
    displayName: 'LinkedIn Ads',
    shortLabel: 'LinkedIn',
    entityLinkLabel: 'View LinkedIn ad',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'social_actions', label: 'Social actions', format: 'number' },
      { key: 'viral_impressions', label: 'Viral impr.', format: 'number' },
    ],
  },
  chatgpt: {
    id: 'chatgpt',
    displayName: 'ChatGPT / OpenAI Ads',
    shortLabel: 'ChatGPT',
    entityLinkLabel: 'View AI placement',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'citation_rate', label: 'Citation rate', format: 'percent' },
      { key: 'share_of_ai_voice', label: 'Share of AI voice', format: 'percent' },
      { key: 'impressions', label: 'Answer impr.', format: 'number' },
      { key: 'clicks', label: 'Clicks', format: 'number' },
      { key: 'spend', label: 'Spend', format: 'currency' },
    ],
  },
  claude: {
    id: 'claude',
    displayName: 'Claude AI Visibility',
    shortLabel: 'Claude',
    entityLinkLabel: 'View AI audit',
    capabilities: { textAds: true, imageAds: false, budgetUpdate: false, pause: true },
    nativeMetricDefs: [
      { key: 'citation_rate', label: 'Citation rate', format: 'percent' },
      { key: 'share_of_ai_voice', label: 'Share of AI voice', format: 'percent' },
      { key: 'ai_referrals', label: 'AI referrals', format: 'number' },
    ],
  },
  perplexity: {
    id: 'perplexity',
    displayName: 'Perplexity Sponsored',
    shortLabel: 'Perplexity',
    entityLinkLabel: 'View AI placement',
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [
      { key: 'citation_rate', label: 'Citation rate', format: 'percent' },
      { key: 'impressions', label: 'Answer impr.', format: 'number' },
      { key: 'clicks', label: 'Clicks', format: 'number' },
      { key: 'spend', label: 'Spend', format: 'currency' },
    ],
  },
};

/**
 * Returns the declarative spec for any ad platform. Unknown future platforms automatically
 * receive a sensible fallback spec so UI matrices and charts work out of the box.
 */
export function getPlatformSpec(platformId: string): PlatformSpec {
  const key = platformId.trim().toLowerCase();
  const hit = REGISTRY[key];
  if (hit) return hit;
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Platform';
  return {
    id: key || 'unknown',
    displayName: `${label} Ads`,
    shortLabel: label,
    entityLinkLabel: `View ${label} ad`,
    capabilities: { textAds: true, imageAds: true, budgetUpdate: true, pause: true },
    nativeMetricDefs: [],
  };
}

export function listRegisteredPlatforms(): PlatformSpec[] {
  return Object.values(REGISTRY);
}
