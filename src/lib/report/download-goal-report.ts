import type { CreativeRecord, GoalStatus } from '../actions/client';
import type { GeoAuditResult } from '../geo/client';
import { formatCurrency, formatNumber } from '../utils/format';

export interface GoalReportInput {
  goalTitle: string;
  goalId: string;
  landingPageUrl?: string;
  status: GoalStatus;
  creative?: CreativeRecord | null;
  geoAudit?: GeoAuditResult | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function aggregateGoalMetrics(status: GoalStatus) {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let hasNativeSpend = false;
  let hasNativeImpr = false;
  let hasNativeClicks = false;
  let hasNativeConv = false;

  for (const c of status.now.campaigns) {
    const nm = c.delivery?.nativeMetrics;
    if (!nm) continue;
    if (typeof nm.spend === 'number') {
      spend += nm.spend;
      hasNativeSpend = true;
    }
    if (typeof nm.impressions === 'number') {
      impressions += nm.impressions;
      hasNativeImpr = true;
    }
    if (typeof nm.clicks === 'number') {
      clicks += nm.clicks;
      hasNativeClicks = true;
    }
    if (typeof nm.conversions === 'number') {
      conversions += nm.conversions;
      hasNativeConv = true;
    }
  }

  const finalSpend = status.spend.spent ?? (hasNativeSpend ? spend : null);
  const finalClicks =
    hasNativeClicks
      ? clicks
      : status.progress.metric === 'clicks' && status.progress.actual !== null
        ? status.progress.actual
        : null;
  const finalImpressions = hasNativeImpr ? impressions : null;
  const finalConversions =
    hasNativeConv
      ? conversions
      : status.progress.metric === 'conversions' && status.progress.actual !== null
        ? status.progress.actual
        : null;

  const ctr =
    finalClicks !== null && finalImpressions !== null && finalImpressions > 0
      ? (finalClicks / finalImpressions) * 100
      : null;
  const cpc =
    finalSpend !== null && finalClicks !== null && finalClicks > 0
      ? finalSpend / finalClicks
      : null;

  return {
    spend: finalSpend,
    impressions: finalImpressions,
    clicks: finalClicks,
    conversions: finalConversions,
    ctr,
    cpc,
  };
}

export function buildGoalReportHtml(input: GoalReportInput): string {
  const { goalTitle, goalId, landingPageUrl, status, creative, geoAudit } = input;
  const currency = status.spend.currency ?? 'GBP';
  const m = aggregateGoalMetrics(status);
  const generatedAt = new Date().toISOString();

  const campaignRows = status.now.campaigns
    .map((c) => {
      const nm = c.delivery?.nativeMetrics;
      const link = c.delivery?.postUrl ?? c.delivery?.previewUrl ?? '';
      return `<tr>
        <td><strong>${escapeHtml(c.platform.toUpperCase())}</strong></td>
        <td>${escapeHtml(c.delivery?.label ?? 'Active')}</td>
        <td>${nm?.impressions != null ? formatNumber(nm.impressions) : '—'}</td>
        <td>${nm?.clicks != null ? formatNumber(nm.clicks) : '—'}</td>
        <td>${nm?.spend != null ? formatCurrency(nm.spend, currency) : '—'}</td>
        <td>${c.currentDailyBudget != null ? formatCurrency(c.currentDailyBudget, c.currency ?? currency) : '—'}</td>
        <td>${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">View Ad</a>` : '—'}</td>
      </tr>`;
    })
    .join('\n');

  const decisionRows = status.decisions
    .map(
      (d) =>
        `<li><span class="muted">${escapeHtml(d.at)}</span> — <strong>${escapeHtml(d.kind)}</strong>: ${escapeHtml(d.summary ?? '')}</li>`
    )
    .join('\n');

  const creativeHtml = creative?.creative
    ? `<section class="card">
        <h2>Active Ad Creative</h2>
        <p><strong>Headline:</strong> ${escapeHtml(creative.creative.headline ?? 'Untitled')}</p>
        <p>${escapeHtml(creative.creative.body ?? '')}</p>
      </section>`
    : '';

  const geoHtml = geoAudit
    ? `<section class="card">
        <h2>AI Brand Visibility (GEO) — ${geoAudit.visibilityScore}%</h2>
        <p class="muted">Domain: ${escapeHtml(geoAudit.domain)}</p>
        <ul>
          ${Object.entries(geoAudit.engineScores)
            .map(
              ([engine, stats]) =>
                `<li><strong>${escapeHtml(engine.toUpperCase())}</strong>: ${stats.mentions > 0 ? 'Mentioned' : 'Not mentioned'} (Score ${stats.score}%)</li>`
            )
            .join('')}
        </ul>
      </section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Proba Campaign Report — ${escapeHtml(goalTitle)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; color: #09090b; background: #fafafa; margin: 0; padding: 32px; }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  h2 { margin: 0 0 12px; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  .muted { color: #64748b; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin: 20px 0; }
  .kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
  .kpi .lbl { font-size: 11px; color: #64748b; text-transform: uppercase; }
  .kpi .val { font-size: 18px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 11px; text-transform: uppercase; color: #64748b; }
  ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(goalTitle)}</h1>
  <div class="muted">Goal ID: ${escapeHtml(goalId)} • Status: ${escapeHtml(status.goal.status)} • Generated: ${escapeHtml(generatedAt)}${landingPageUrl ? ` • URL: ${escapeHtml(landingPageUrl)}` : ''}</div>

  <div class="kpis">
    <div class="kpi"><div class="lbl">Spend</div><div class="val">${m.spend !== null ? formatCurrency(m.spend, currency) : '—'}</div></div>
    <div class="kpi"><div class="lbl">Daily Cap</div><div class="val">${status.spend.dailyCap !== null ? formatCurrency(status.spend.dailyCap, currency) : 'Auto'}</div></div>
    <div class="kpi"><div class="lbl">Impressions</div><div class="val">${m.impressions !== null ? formatNumber(m.impressions) : '—'}</div></div>
    <div class="kpi"><div class="lbl">Clicks</div><div class="val">${m.clicks !== null ? formatNumber(m.clicks) : '—'}</div></div>
    <div class="kpi"><div class="lbl">CTR</div><div class="val">${m.ctr !== null ? `${m.ctr.toFixed(2)}%` : '—'}</div></div>
    <div class="kpi"><div class="lbl">CPC</div><div class="val">${m.cpc !== null ? formatCurrency(m.cpc, currency) : '—'}</div></div>
  </div>

  <section class="card">
    <h2>Platform Campaigns (${status.now.campaigns.length})</h2>
    <table>
      <thead><tr><th>Platform</th><th>Delivery</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Daily Cap</th><th>Ad Link</th></tr></thead>
      <tbody>${campaignRows || '<tr><td colspan="7" class="muted">No platform campaigns recorded yet.</td></tr>'}</tbody>
    </table>
  </section>

  ${creativeHtml}
  ${geoHtml}

  <section class="card">
    <h2>Agent Decisions & Activity (${status.decisions.length})</h2>
    <ul>${decisionRows || '<li class="muted">No decisions recorded yet.</li>'}</ul>
  </section>
</div>
</body>
</html>`;
}

export function downloadGoalReport(input: GoalReportInput): void {
  const html = buildGoalReportHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const slug = input.goalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
  const a = document.createElement('a');
  a.href = url;
  a.download = `proba-report-${slug}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
